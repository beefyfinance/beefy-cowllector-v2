import axios from 'axios';
import { HarvestReport, serializeReport } from './harvest-report';
import { DISCORD_WEBHOOK_URL } from '../util/config';
import { rootLogger } from '../util/logger';
import { Blob, File } from 'buffer';
import { bigintFormat } from '../util/bigint';
import { getChainWNativeTokenSymbol } from './addressbook';

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

    let reportLevel: string;
    if (report.summary.errors > 0) {
        reportLevel = '🔥 ERROR';
    } else if (report.summary.warnings > 0) {
        reportLevel = '⚠️ WARNING';
    } else {
        reportLevel = 'ℹ️ INFO';
    }

    const wnativeSymbol = getChainWNativeTokenSymbol(report.chain);

    const harvestStats: string[] = [];
    if (report.summary.totalStrategies > 0) {
        harvestStats.push(`T=${report.summary.totalStrategies}`);
    }
    if (report.summary.harvested > 0) {
        harvestStats.push(`🌾=${report.summary.harvested}`);
    }
    if (report.summary.skipped > 0) {
        harvestStats.push(`⇏=${report.summary.skipped}`);
    }
    if (report.summary.errors > 0) {
        harvestStats.push(`🔴=${report.summary.errors}`);
    }
    if (report.summary.warnings > 0) {
        harvestStats.push(`⚠️=${report.summary.warnings}`);
    }

    const params: DiscordWebhookParams = {
        content: `
### ${reportLevel} for ${report.chain.toLocaleUpperCase()}
- Strats: ${harvestStats.join(' ')}
- balance: 
  - before: ${
      report.collectorBalanceBefore && report.collectorBalanceBefore.status === 'fulfilled'
          ? bigintFormat(report.collectorBalanceBefore.value.balanceWei, 18)
          : '??'
  } ${wnativeSymbol}
  - after:  ${
      report.collectorBalanceAfter && report.collectorBalanceAfter.status === 'fulfilled'
          ? bigintFormat(report.collectorBalanceAfter.value.balanceWei, 18)
          : '??'
  } ${wnativeSymbol}
  - profit: ${bigintFormat(report.summary.totalProfitWei, 18)} ${wnativeSymbol}
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
