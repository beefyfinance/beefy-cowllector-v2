import type { Hex } from 'viem';
import yargs from 'yargs';
import { allChainIds } from '../lib/chain';
import type { Chain } from '../lib/chain';
import { DISABLE_COLLECTOR_FOR_CHAINS, DISCORD_REPORT_ONLY_FOR_CHAINS, RPC_CONFIG } from '../lib/config';
import { insertHarvestReport } from '../lib/db/db-report';
import { withDbClient } from '../lib/db/utils';
import {
    extractHarvestReportItemErrorDiscordMessageDetails,
    getStrategyDiscordMessageLink,
    getTransactionDiscordMessageLink,
    getVaultDiscordMessageLink,
} from '../lib/discord-message';
import { harvestChain } from '../lib/harvest-chain';
import { createDefaultHarvestReport } from '../lib/harvest-report';
import { notifyError, notifyHarvestReport } from '../lib/notify';
import {
    type ReportAsyncStatusContext,
    getMergedReportAsyncStatus,
    getReportAsyncStatus,
    getReportAsyncStatusCounts,
} from '../lib/report-error-status';
import { getVaultsToMonitorByChain } from '../lib/vault-list';
import { asyncResultGet, promiseTimings } from '../util/async';
import { rootLogger } from '../util/logger';
import { runMain } from '../util/process';
import { splitPromiseResultsByStatus } from '../util/promise';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain[];
    strategyAddress: Hex | null;
    now: Date;
    dryRun: boolean;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'array',
            choices: [...allChainIds, 'all'],
            alias: 'c',
            demand: false,
            default: 'all',
            describe: 'only harest these chains. eol chains will be ignored',
        },
        'strategy-address': {
            type: 'string',
            demand: false,
            alias: 'a',
            describe: 'only harvest for this strategy address',
        },
        now: {
            type: 'string',
            demand: false,
            alias: 'n',
            describe: 'force the current date time instead of using Date.now()',
        },
        dryRun: {
            type: 'boolean',
            demand: false,
            default: false,
            alias: 'd',
            describe: 'dry run',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
        strategyAddress: (argv['strategy-address'] || null) as Hex | null,
        now: argv.now ? new Date(argv.now) : new Date(Date.now()),
        dryRun: argv.dryRun,
    };
    logger.trace({ msg: 'running with options', data: options });

    // fetch vaults from beefy api
    const vaultsByChain = await getVaultsToMonitorByChain({
        chains: options.chain,
        strategyAddress: options.strategyAddress,
    });

    // harvest each chain
    const { fulfilled: successfulReports, rejected: rejectedReports } = splitPromiseResultsByStatus(
        await Promise.allSettled(
            Object.entries(vaultsByChain)
                .map(([chain, vaults]) => [chain as Chain, vaults] as const)
                .filter(([chain, _]) => {
                    const isChainDisabled = DISABLE_COLLECTOR_FOR_CHAINS.includes(chain);
                    if (isChainDisabled) {
                        logger.warn({
                            msg: 'Skipping chain, disabled by env var DISABLE_COLLECTOR_FOR_CHAINS',
                            data: { chain },
                        });
                    }
                    return !isChainDisabled;
                })
                // remove eol chains
                .filter(([chain, _]) => {
                    const isChainEol = RPC_CONFIG[chain].eol;
                    if (isChainEol) {
                        logger.warn({
                            msg: 'Skipping chain, eol',
                            data: { chain },
                        });
                    }
                    return !isChainEol;
                })
                .filter(([chain, _]) => {
                    const harvestEnabled = RPC_CONFIG[chain].harvest.enabled;
                    if (!harvestEnabled) {
                        logger.warn({
                            msg: 'Skipping chain, harvest is disabled',
                            data: { chain },
                        });
                    }
                    return harvestEnabled;
                })
                // remove eol vaults
                .map(([chain, vaults]) => [chain, vaults.filter(vault => !vault.eol)] as const)
                // only those with vaults left
                .filter(([_, vaults]) => vaults.length > 0)
                .map(async ([chain, vaults]) => {
                    // create the report objects
                    const report = createDefaultHarvestReport({ chain });
                    const result = await promiseTimings(() =>
                        harvestChain({
                            report,
                            now: options.now,
                            chain: chain as Chain,
                            vaults,
                            dryRun: options.dryRun,
                        })
                    );

                    if (result.status === 'rejected') {
                        logger.error({
                            msg: 'Harvesting errored',
                            data: { chain, error: result.reason },
                        });
                        logger.trace(result.reason);
                    }

                    // update the summary
                    report.timing = result.timing;
                    for (const item of report.details) {
                        const trxStatus = getReportAsyncStatus({ chain, vault: item.vault }, item.transaction);
                        item.summary = {
                            harvested: trxStatus === 'success',
                            skipped: trxStatus === 'not-started',
                            status: getMergedReportAsyncStatus({ chain, vault: item.vault }, [
                                item.simulation,
                                item.decision,
                                item.transaction,
                            ]),
                            estimatedProfitWei:
                                item.transaction?.status === 'fulfilled'
                                    ? item.transaction?.value.estimatedProfitWei
                                    : 0n,
                            discordMessage: null,
                            discordVaultLink: null,
                            discordStrategyLink: null,
                            discordTransactionLink: null,
                        };
                        item.summary.discordMessage = extractHarvestReportItemErrorDiscordMessageDetails(chain, item);
                        item.summary.discordVaultLink = getVaultDiscordMessageLink(chain, item.vault);
                        item.summary.discordStrategyLink = getStrategyDiscordMessageLink(chain, item.vault);
                        if (item.transaction?.status === 'fulfilled') {
                            item.summary.discordTransactionLink = getTransactionDiscordMessageLink(
                                chain,
                                item.transaction.value.transactionHash
                            );
                        }
                    }

                    const statusCtx: ReportAsyncStatusContext = { chain, vault: null };
                    report.summary = {
                        statuses: getReportAsyncStatusCounts([
                            ...report.details.map(item => item.summary.status),
                            getReportAsyncStatus(statusCtx, report.fetchGasPrice),
                            getReportAsyncStatus(statusCtx, report.collectorBalanceBefore),
                            getReportAsyncStatus(statusCtx, report.collectorBalanceAfter),
                        ]),
                        aggregatedProfitWei:
                            asyncResultGet(report.collectorBalanceAfter, ba =>
                                asyncResultGet(
                                    report.collectorBalanceBefore,
                                    bb => ba.aggregatedBalanceWei - bb.aggregatedBalanceWei
                                )
                            ) || 0n,
                        nativeGasUsedWei:
                            asyncResultGet(report.collectorBalanceAfter, ba =>
                                asyncResultGet(report.collectorBalanceBefore, bb => ba.balanceWei - bb.balanceWei)
                            ) || 0n,
                        wnativeProfitWei:
                            asyncResultGet(report.collectorBalanceAfter, ba =>
                                asyncResultGet(
                                    report.collectorBalanceBefore,
                                    bb => ba.wnativeBalanceWei - bb.wnativeBalanceWei
                                )
                            ) || 0n,
                        harvested: report.details.filter(item => item.summary.harvested).length,
                        skipped: report.details.filter(item => item.summary.skipped).length,
                        totalStrategies: report.details.length,
                    };

                    let db_raw_report_id: number | null = null;
                    try {
                        const res = await insertHarvestReport(report);
                        db_raw_report_id = res.raw_report_id;
                    } catch (e) {
                        logger.error({
                            msg: 'Failed to insert report into db',
                            data: { chain, error: e },
                        });
                        logger.trace(e);
                        await notifyError(
                            {
                                doing: 'insert harvest report',
                                data: { chain: report.chain },
                            },
                            e
                        );
                    }

                    if (DISCORD_REPORT_ONLY_FOR_CHAINS.includes(chain)) {
                        await notifyHarvestReport(report, db_raw_report_id);
                    }
                    logger.debug({
                        msg: 'Harvesting done',
                        data: { chain, db_raw_report_id, notifyHarvestReport },
                    });

                    return report;
                })
        )
    );
    logger.trace({
        msg: 'harvest results',
        data: { successfulReports, rejectedReports },
    });
    const successfulChains = successfulReports.map(r => r.chain);
    logger.info({
        msg: 'Harvesting done',
        data: {
            successfulChains,
            rejectedChains: options.chain.filter(c => !successfulChains.includes(c)),
        },
    });
    if (rejectedReports.length > 0) {
        logger.debug({
            msg: 'Some chains errored',
            data: {
                count: rejectedReports.length,
                rejectedReports: rejectedReports.map(r => `${r}`),
            },
        });
        for (const rejectedReport of rejectedReports) {
            logger.error(rejectedReport);
            try {
                await notifyError({ doing: 'harvest', data: { chain: rejectedReport.chain } }, rejectedReport);
            } catch (e) {
                logger.error({
                    msg: 'Failed to notify error',
                    data: { chain: rejectedReport.chain, error: e },
                });
                logger.trace(e);
            }
        }
    }
}

runMain(withDbClient(main, { appName: 'cowllector-harvest' }));
