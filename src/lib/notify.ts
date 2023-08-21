import axios from 'axios';
import { HarvestReport, serializeReport } from './harvest-report';
import { DISCORD_WEBHOOK_URL, NOTIFY_UNEVENTFUL_HARVEST } from './config';
import { rootLogger } from '../util/logger';
import { Blob, File } from 'buffer';
import { bigintFormat } from '../util/bigint';
import { getChainWNativeTokenSymbol } from './addressbook';
import { table } from 'table';
import { asyncResultGet } from '../util/async';

const logger = rootLogger.child({ module: 'notify' });

type DiscordWebhookParams = {
    content: string;
    username?: string;
    avatar_url?: string;
};

export async function notifyReport(report: HarvestReport) {
    if (!DISCORD_WEBHOOK_URL) {
        logger.warn({ msg: 'DISCORD_WEBHOOK_URL not set, not sending any discord message' });
        return;
    }

    if (report.summary.harvested === 0 && report.summary.errors === 0 && report.summary.warnings === 0) {
        logger.info({ msg: 'All strats were skipped, not reporting', data: report.summary });
        if (!NOTIFY_UNEVENTFUL_HARVEST) {
            return;
        }
    }

    logger.info({ msg: 'notifying harvest for report', data: { chain: report.chain } });

    let reportLevel: string;
    if (report.summary.errors > 0) {
        reportLevel = '🔥 ERROR';
    } else if (report.summary.warnings > 0) {
        reportLevel = '⚠️ WARNING';
    } else {
        reportLevel = 'ℹ️ INFO';
    }

    const stratCountTableStr = table(
        [
            ['strategies', 'skipped', 'harvested', 'errors', 'warnings'],
            [
                report.summary.totalStrategies,
                report.summary.skipped,
                report.summary.harvested,
                report.summary.errors,
                report.summary.warnings,
            ],
        ],
        {
            drawHorizontalLine: (lineIndex: number, rowCount: number) => {
                return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount - 1 || lineIndex === rowCount;
            },
            columns: [
                { alignment: 'right' },
                { alignment: 'right' },
                { alignment: 'right' },
                { alignment: 'right' },
                { alignment: 'right' },
            ],
        }
    );

    const wnativeSymbol = getChainWNativeTokenSymbol(report.chain);
    const nativeSymbol = wnativeSymbol.slice(1); // remove "w" or "W" prefix

    const balanceTableStr = table(
        [
            ['balance of', nativeSymbol, wnativeSymbol, `${nativeSymbol} + ${wnativeSymbol}`],
            [
                'before',
                asyncResultGet(report.collectorBalanceBefore, b => bigintFormat(b.balanceWei, 18, 8)) || '??',
                asyncResultGet(report.collectorBalanceBefore, b => bigintFormat(b.wnativeBalanceWei, 18, 8)) || '??',
                asyncResultGet(report.collectorBalanceBefore, b => bigintFormat(b.aggregatedBalanceWei, 18, 8)) || '??',
            ],
            [
                'after',
                asyncResultGet(report.collectorBalanceAfter, b => bigintFormat(b.balanceWei, 18, 8)) || '??',
                asyncResultGet(report.collectorBalanceAfter, b => bigintFormat(b.wnativeBalanceWei, 18, 8)) || '??',
                asyncResultGet(report.collectorBalanceAfter, b => bigintFormat(b.aggregatedBalanceWei, 18, 8)) || '??',
            ],
            [
                'profit',
                bigintFormat(report.summary.nativeGasUsedWei, 18, 8) || '??',
                bigintFormat(report.summary.wnativeProfitWei, 18, 8) || '??',
                bigintFormat(report.summary.aggregatedProfitWei, 18, 8) || '??',
            ],
        ],
        {
            drawHorizontalLine: (lineIndex: number, rowCount: number) => {
                return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount - 1 || lineIndex === rowCount;
            },
            columns: [{ alignment: 'left' }, { alignment: 'right' }, { alignment: 'right' }, { alignment: 'right' }],
        }
    );

    const codeSep = '```';
    const params: DiscordWebhookParams = {
        content: `
### ${reportLevel} for ${report.chain.toLocaleUpperCase()}
${codeSep}
${stratCountTableStr}
${balanceTableStr}
${codeSep}`,
    };

    try {
        const reportStr = serializeReport(report, true);
        const reportBlob = new Blob([reportStr], { type: 'application/json' });
        const reportFile = new File([reportBlob], `report_${report.chain}.json`);

        const form = new FormData();
        form.append('payload_json', JSON.stringify(params));
        form.append('file1', reportFile as any);

        await axios.post(DISCORD_WEBHOOK_URL, form);
    } catch (e) {
        logger.error({ msg: 'something went wrong sending discord message', data: { e } });
        logger.trace(e);
    }
}
