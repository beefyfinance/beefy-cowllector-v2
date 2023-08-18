import axios from 'axios';
import { HarvestReport, serializeReport } from './harvest-report';
import { DISCORD_WEBHOOK_URL } from '../util/config';
import { rootLogger } from '../util/logger';
import { Blob, File } from 'buffer';

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
        return;
    }

    logger.info({ msg: 'notifying harvest for report', data: { chain: report.chain } });
    const params: DiscordWebhookParams = {
        content: `
- chain: ${report.chain}
- totalProfitWei: ${report.summary.totalProfitWei}
- totalStrategies: ${report.summary.totalStrategies}
- harvested: ${report.summary.harvested}
- skipped: ${report.summary.skipped}
- errors: ${report.summary.errors}
- warnings: ${report.summary.warnings}
        `,
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
