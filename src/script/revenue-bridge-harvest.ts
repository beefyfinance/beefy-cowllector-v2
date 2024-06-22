import yargs from 'yargs';
import { allChainIds } from '../lib/chain';
import type { Chain } from '../lib/chain';
import { DISABLE_COLLECTOR_FOR_CHAINS, DISCORD_REPORT_ONLY_FOR_CHAINS, RPC_CONFIG } from '../lib/config';
import { insertRevenueBridgeHarvestReport } from '../lib/db/db-report';
import { withDbClient } from '../lib/db/utils';
import { notifyError, notifyRevenueBridgeHarvestReport } from '../lib/notify';
import { revenueBridgeHarvestChain } from '../lib/revenue-bridge-harvest-chain';
import { createDefaultRevenueBridgeHarvestReport } from '../lib/revenue-bridge-harvest-report';
import { asyncResultGet, promiseTimings } from '../util/async';
import { rootLogger } from '../util/logger';
import { runMain } from '../util/process';
import { splitPromiseResultsByStatus } from '../util/promise';

const logger = rootLogger.child({ module: 'revenue-bridge-harvest-main' });

type CmdOptions = {
    chain: Chain[];
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'array',
            choices: [...allChainIds, 'all'],
            alias: 'c',
            demand: false,
            default: 'all',
            describe: 'only harest revenue bridge for these chains. eol chains will be ignored',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
    };
    logger.trace({ msg: 'running with options', data: options });

    // harvest each chain
    const { fulfilled: successfulReports, rejected: rejectedReports } = splitPromiseResultsByStatus(
        await Promise.allSettled(
            options.chain
                .filter(chain => {
                    const isChainDisabled = DISABLE_COLLECTOR_FOR_CHAINS.includes(chain);
                    if (isChainDisabled) {
                        logger.warn({
                            msg: 'Skipping chain, disabled by env var DISABLE_COLLECTOR_FOR_CHAINS',
                            data: { chain },
                        });
                    }
                    return !isChainDisabled;
                })
                .filter(chain => {
                    const isChainDisabled = !RPC_CONFIG[chain].revenueBridgeHarvest.enabled;
                    if (isChainDisabled) {
                        logger.debug({
                            msg: 'Unwrap is disabled for chain',
                            data: { chain },
                        });
                    }
                    return !isChainDisabled;
                })
                .filter(chain => {
                    const isChainEol = RPC_CONFIG[chain].eol;
                    if (isChainEol) {
                        logger.debug({ msg: 'Skipping eol chain', data: { chain } });
                    }
                    return !isChainEol;
                })
                .map(async chain => {
                    const report = createDefaultRevenueBridgeHarvestReport({ chain });
                    const result = await promiseTimings(() => revenueBridgeHarvestChain({ report, chain }));

                    if (result.status === 'rejected') {
                        logger.error({
                            msg: 'Revenue bridge harvest errored',
                            data: { chain, error: result.reason },
                        });
                    }

                    // update the summary
                    report.timing = result.timing;
                    report.summary = {
                        success: report.harvestTransaction?.status === 'fulfilled',
                        revenueBridgeHarvested: report.harvestTransaction?.status === 'fulfilled',
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
                    };

                    let db_raw_report_id: number | null = null;
                    try {
                        const res = await insertRevenueBridgeHarvestReport(report);
                        db_raw_report_id = res.raw_report_id;
                    } catch (e) {
                        logger.error({
                            msg: 'Failed to insert report into db',
                            data: { chain, error: e },
                        });
                        logger.trace(e);
                        await notifyError(
                            {
                                doing: 'insert unwrap report',
                                data: { chain: report.chain },
                            },
                            e
                        );
                    }

                    if (DISCORD_REPORT_ONLY_FOR_CHAINS.includes(chain)) {
                        await notifyRevenueBridgeHarvestReport(report, db_raw_report_id);
                    }
                    logger.debug({
                        msg: 'Revenue bridge harvest done',
                        data: {
                            chain,
                            db_raw_report_id,
                            notifyRevenueBridgeHarvestReport,
                        },
                    });

                    return report;
                })
        )
    );
    logger.trace({
        msg: 'revenue bridge harvest results',
        data: { successfulReports, rejectedReports },
    });
    const successfulChains = successfulReports.map(r => r.chain);
    logger.info({
        msg: 'revenue bridge harvest done',
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
        for (const rejectedReportError of rejectedReports) {
            logger.error(rejectedReportError);
            try {
                await notifyError(
                    {
                        doing: 'revenue-bridge-harvest',
                        data: { chain: rejectedReportError.chain },
                    },
                    rejectedReportError
                );
            } catch (e) {
                logger.error({
                    msg: 'Failed to notify error',
                    data: { chain: rejectedReportError.chain, error: e },
                });
                logger.trace(e);
            }
        }
    }
}

runMain(withDbClient(main, { appName: 'cowllector-revenue-bridge-harvest' }));
