import { Blob, File } from 'node:buffer';
import AsyncLock from 'async-lock';
import axios from 'axios';
import { table } from 'table';
import { asyncResultGet } from '../util/async';
import { bigintFormat } from '../util/bigint';
import { rootLogger } from '../util/logger';
import { wait } from '../util/promise';
import {getChainNativeSymbol, getChainWNativeTokenSymbol} from './addressbook';
import {
    DISCORD_ALERT_WEBHOOK_URL,
    DISCORD_NOTIFY_UNEVENTFUL_HARVEST,
    DISCORD_PING_ROLE_IDS_ON_ERROR,
    DISCORD_RATE_LIMIT_MIN_SECONDS_BETWEEN_REQUESTS,
    DISCORD_REPORT_WEBHOOK_URL,
    REPORT_URL_TEMPLATE,
} from './config';
import type { AnyReport } from './db/report-types';
import { extractErrorMessage } from './error-message';
import type { HarvestReport } from './harvest-report';
import { removeSecretsFromString, serializeReport } from './reports';
import type { RevenueBridgeHarvestReport } from './revenue-bridge-harvest-report';
import type { UnwrapReport } from './unwrap-report';

const logger = rootLogger.child({ module: 'notify' });

type DiscordWebhookParams = {
    content: string;
    username?: string;
    avatar_url?: string;
};

export async function notifyHarvestReport(report: HarvestReport, db_raw_report_id: number | null) {
    if (!DISCORD_REPORT_WEBHOOK_URL) {
        logger.warn({
            msg: 'DISCORD_REPORT_WEBHOOK_URL not set, not sending any discord message',
        });
        return;
    }

    if (
        report.summary.harvested === 0 &&
        report.summary.statuses.error === 0 &&
        report.summary.statuses.warning === 0 &&
        report.summary.statuses.notice === 0
    ) {
        logger.info({
            msg: 'All strats were skipped, not reporting',
            data: report.summary,
        });
        if (!DISCORD_NOTIFY_UNEVENTFUL_HARVEST) {
            return;
        }
    }

    logger.info({
        msg: 'notifying harvest for report',
        data: { chain: report.chain },
    });

    let reportLevel: string;
    if (report.summary.statuses.error > 0) {
        reportLevel = '🔥 ERROR';
    } else if (report.summary.statuses.warning > 0) {
        reportLevel = '⚠️ WARNING';
    } else {
        reportLevel = 'ℹ️ INFO';
    }

    const stratCountTableStr = table(
        [
            ['strategies', report.summary.totalStrategies],
            ['skipped', report.summary.skipped],
            ['info', report.summary.statuses.info],
            ['notices', report.summary.statuses.notice],
            ['warnings', report.summary.statuses.warning],
            ['errors', report.summary.statuses.error],
            ['harvested', report.summary.harvested],
        ],
        {
            drawHorizontalLine: (lineIndex: number, rowCount: number) => {
                return [0, 1, 3, 6, 7].includes(lineIndex);
            },
            columns: [{ alignment: 'right' }, { alignment: 'left' }],
        }
    );

    let errorDetails = '';
    for (const stratReport of report.details) {
        if (stratReport.summary.discordMessage) {
            errorDetails += `${stratReport.summary.discordMessage}\n`;
        }
    }

    // disable role ping for now
    const rolePing =
        (report.summary.statuses.error > 0 ||
            report.summary.statuses.warning > 0 ||
            DISCORD_NOTIFY_UNEVENTFUL_HARVEST) &&
        DISCORD_PING_ROLE_IDS_ON_ERROR.length
            ? DISCORD_PING_ROLE_IDS_ON_ERROR.map(roleId => `<@&${roleId}>`)
            : '';

    const reportUrl = db_raw_report_id ? REPORT_URL_TEMPLATE.replace('{{reportId}}', db_raw_report_id.toString()) : '';
    const reportUrlMarkdown = `[full report](${reportUrl})`;

    const codeSep = '```';
    const params: DiscordWebhookParams = {
        content: removeSecretsFromString(`
### Harvest ${reportLevel} for ${report.chain.toLocaleUpperCase()}
${reportUrlMarkdown}
${codeSep}
${stratCountTableStr}
${getBalanceReportTable(report)}
${codeSep}
${errorDetails}
${rolePing}`),
    };

    try {
        const reportStr = serializeReport(report, true);
        const reportBlob = new Blob([reportStr], { type: 'application/json' });
        const reportFile = new File([reportBlob], `report_${report.chain}.json`);

        const form = new FormData();
        form.append('payload_json', JSON.stringify(params));
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        form.append('file1', reportFile as any);

        await sendRateLimitedReport(form);
    } catch (e) {
        logger.error({
            msg: 'something went wrong sending discord message',
            data: { e },
        });
        logger.trace(e);
    }
}

export async function notifyUnwrapReport(report: UnwrapReport, db_raw_report_id: number | null) {
    if (!DISCORD_REPORT_WEBHOOK_URL) {
        logger.warn({
            msg: 'DISCORD_REPORT_WEBHOOK_URL not set, not sending any discord message',
        });
        return;
    }

    if (report.summary.success === true && report.summary.unwrapped === false) {
        logger.info({
            msg: 'Did not unwrap anything, not reporting',
            data: report.summary,
        });
        if (!DISCORD_NOTIFY_UNEVENTFUL_HARVEST) {
            return;
        }
    }

    logger.info({
        msg: 'notifying unwrap report',
        data: { chain: report.chain },
    });

    let reportLevel: string;
    if (!report.summary.success) {
        reportLevel = '🔥 ERROR';
    } else {
        reportLevel = 'ℹ️ INFO';
    }

    let errorDetails = '';
    if (report.unwrapDecision && report.unwrapDecision.status === 'rejected') {
        errorDetails += `- 🔥 Unwrap decision failed: ${extractErrorMessage(report.unwrapDecision)}\n`;
    }
    if (report.unwrapTransaction && report.unwrapTransaction.status === 'rejected') {
        errorDetails += `- 🔥 Unwrap transaction failed: ${extractErrorMessage(report.unwrapTransaction)}\n`;
    }

    // disable role ping for now
    const rolePing =
        (!report.summary.success || DISCORD_NOTIFY_UNEVENTFUL_HARVEST) && DISCORD_PING_ROLE_IDS_ON_ERROR.length
            ? DISCORD_PING_ROLE_IDS_ON_ERROR.map(roleId => `<@&${roleId}>`)
            : '';

    const reportUrl = db_raw_report_id ? REPORT_URL_TEMPLATE.replace('{{reportId}}', db_raw_report_id.toString()) : '';
    const reportUrlMarkdown = `[full report](${reportUrl})`;

    const codeSep = '```';
    const params: DiscordWebhookParams = {
        content: removeSecretsFromString(`
### Wnative unwrap ${reportLevel} for ${report.chain.toLocaleUpperCase()}
${reportUrlMarkdown}
${report.summary.unwrapped ? codeSep + getBalanceReportTable(report) + codeSep : ''}  
${errorDetails}
${rolePing}`),
    };

    try {
        const reportStr = serializeReport(report, true);
        const reportBlob = new Blob([reportStr], { type: 'application/json' });
        const reportFile = new File([reportBlob], `report_${report.chain}.json`);

        const form = new FormData();
        form.append('payload_json', JSON.stringify(params));
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        form.append('file1', reportFile as any);

        await sendRateLimitedReport(form);
    } catch (e) {
        logger.error({
            msg: 'something went wrong sending discord message',
            data: { e },
        });
        logger.trace(e);
    }
}

export async function notifyRevenueBridgeHarvestReport(
    report: RevenueBridgeHarvestReport,
    db_raw_report_id: number | null
) {
    if (!DISCORD_REPORT_WEBHOOK_URL) {
        logger.warn({
            msg: 'DISCORD_REPORT_WEBHOOK_URL not set, not sending any discord message',
        });
        return;
    }

    if (report.summary.success === true && report.summary.revenueBridgeHarvested === false) {
        logger.info({
            msg: 'Did not revenue bridge harvest anything, not reporting',
            data: report.summary,
        });
        if (!DISCORD_NOTIFY_UNEVENTFUL_HARVEST) {
            return;
        }
    }

    logger.info({
        msg: 'notifying revenue bridge harvest report',
        data: { chain: report.chain },
    });

    let reportLevel: string;
    if (!report.summary.success) {
        reportLevel = '🔥 ERROR';
    } else {
        reportLevel = 'ℹ️ INFO';
    }

    let errorDetails = '';
    if (report.harvestTransaction && report.harvestTransaction.status === 'rejected') {
        errorDetails += `- 🔥 Revenue bridge harvest transaction failed: ${extractErrorMessage(
            report.harvestTransaction
        )}\n`;
    }

    // disable role ping for now
    const rolePing =
        (!report.summary.success || DISCORD_NOTIFY_UNEVENTFUL_HARVEST) && DISCORD_PING_ROLE_IDS_ON_ERROR.length
            ? DISCORD_PING_ROLE_IDS_ON_ERROR.map(roleId => `<@&${roleId}>`)
            : '';

    const reportUrl = db_raw_report_id ? REPORT_URL_TEMPLATE.replace('{{reportId}}', db_raw_report_id.toString()) : '';
    const reportUrlMarkdown = `[full report](${reportUrl})`;

    const codeSep = '```';
    const params: DiscordWebhookParams = {
        content: removeSecretsFromString(`
### Revenue Bridge Harvest ${reportLevel} for ${report.chain.toLocaleUpperCase()}
${reportUrlMarkdown}
${report.summary.revenueBridgeHarvested ? codeSep + getBalanceReportTable(report) + codeSep : ''}  
${errorDetails}
${rolePing}`),
    };

    try {
        const reportStr = serializeReport(report, true);
        const reportBlob = new Blob([reportStr], { type: 'application/json' });
        const reportFile = new File([reportBlob], `report_${report.chain}.json`);

        const form = new FormData();
        form.append('payload_json', JSON.stringify(params));
        // biome-ignore lint/suspicious/noExplicitAny: this works
        form.append('file1', reportFile as any);

        await sendRateLimitedReport(form);
    } catch (e) {
        logger.error({
            msg: 'something went wrong sending discord message',
            data: { e },
        });
        logger.trace(e);
    }
}

function getBalanceReportTable(report: AnyReport) {
    const wnativeSymbol = getChainWNativeTokenSymbol(report.chain);
    if (!wnativeSymbol) {
        return '??';
    }
    const nativeSymbol = getChainNativeSymbol(report.chain);

    return table(
        [
            ['', nativeSymbol, wnativeSymbol, 'sum'],
            [
                'before',
                asyncResultGet(report.collectorBalanceBefore, b => bigintFormat(b.balanceWei, 18, 6)) || '??',
                asyncResultGet(report.collectorBalanceBefore, b => bigintFormat(b.wnativeBalanceWei, 18, 6)) || '??',
                asyncResultGet(report.collectorBalanceBefore, b => bigintFormat(b.aggregatedBalanceWei, 18, 6)) || '??',
            ],
            [
                'after',
                asyncResultGet(report.collectorBalanceAfter, b => bigintFormat(b.balanceWei, 18, 6)) || '??',
                asyncResultGet(report.collectorBalanceAfter, b => bigintFormat(b.wnativeBalanceWei, 18, 6)) || '??',
                asyncResultGet(report.collectorBalanceAfter, b => bigintFormat(b.aggregatedBalanceWei, 18, 6)) || '??',
            ],
            [
                'profit',
                bigintFormat(report.summary.nativeGasUsedWei, 18, 6) || '??',
                bigintFormat(report.summary.wnativeProfitWei, 18, 6) || '??',
                bigintFormat(report.summary.aggregatedProfitWei, 18, 6) || '??',
            ],
        ],
        {
            drawHorizontalLine: (lineIndex: number, rowCount: number) => {
                return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount - 1 || lineIndex === rowCount;
            },
            columns: [{ alignment: 'left' }, { alignment: 'right' }, { alignment: 'right' }, { alignment: 'right' }],
        }
    );
}

export async function notifyError(ctx: { doing: string; data: unknown }, error: unknown) {
    if (!DISCORD_ALERT_WEBHOOK_URL) {
        logger.warn({
            msg: 'DISCORD_ALERT_WEBHOOK_URL not set, not sending any discord message',
        });
        return;
    }

    logger.info({ msg: 'notifying error', data: { error } });

    const codeSep = '```';
    const params: DiscordWebhookParams = {
        content: removeSecretsFromString(`
### 🚨 ERROR while ${ctx.doing}
${codeSep}
${String(error)}
${codeSep}
${codeSep}
${JSON.stringify(ctx.data, null, 2)}
${codeSep}
`),
    };

    try {
        const form = new FormData();
        form.append('payload_json', JSON.stringify(params));

        await axios.post(DISCORD_ALERT_WEBHOOK_URL, form);
    } catch (e) {
        logger.error({
            msg: 'something went wrong sending discord message',
            data: { e },
        });
        logger.trace(e);
    }
}

const lock = new AsyncLock({
    timeout: DISCORD_RATE_LIMIT_MIN_SECONDS_BETWEEN_REQUESTS * 30 * 1000,
});
let lastSentTime: Date = new Date(0);

async function sendRateLimitedReport(form: FormData) {
    if (!DISCORD_REPORT_WEBHOOK_URL) {
        logger.warn({
            msg: 'DISCORD_REPORT_WEBHOOK_URL not set, not sending any discord message',
        });
        return null;
    }
    const url = DISCORD_REPORT_WEBHOOK_URL;

    let now = new Date();
    return await lock.acquire('discord', async () => {
        now = new Date();
        const secondsSinceLastSent = (now.getTime() - lastSentTime.getTime()) / 1000;
        if (secondsSinceLastSent < DISCORD_RATE_LIMIT_MIN_SECONDS_BETWEEN_REQUESTS) {
            logger.info({
                msg: 'rate limiting discord message',
                data: {
                    secondsSinceLastSent,
                    DISCORD_RATE_LIMIT_MIN_SECONDS_BETWEEN_REQUESTS,
                },
            });
            await wait(DISCORD_RATE_LIMIT_MIN_SECONDS_BETWEEN_REQUESTS * 1000 - secondsSinceLastSent * 1000);
        }
        lastSentTime = now;

        return axios.post(url, form);
    });
}
