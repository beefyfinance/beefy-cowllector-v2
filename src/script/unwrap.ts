import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../lib/chain';
import type { Chain } from '../lib/chain';
import { rootLogger } from '../util/logger';
import { splitPromiseResultsByStatus } from '../util/promise';
import { unwrapChain } from '../lib/unwrap-chain';
import { createDefaultUnwrapReport } from '../lib/unwrap-report';
import { asyncResultGet, promiseTimings } from '../util/async';
import { notifyError, notifyUnwrapReport } from '../lib/notify';
import { DISABLE_COLLECTOR_FOR_CHAINS, RPC_CONFIG } from '../lib/config';
import { withDbClient } from '../lib/db/utils';
import { insertUnwrapReport } from '../lib/db/db-report';

const logger = rootLogger.child({ module: 'harvest-main' });

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
            describe: 'only harest these chains. eol chains will be ignored',
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
                    const isChainDisabled = !RPC_CONFIG[chain].unwrap.enabled;
                    if (isChainDisabled) {
                        logger.debug({ msg: 'Unwrap is disabled for chain', data: { chain } });
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
                    let report = createDefaultUnwrapReport({ chain });
                    const result = await promiseTimings(() => unwrapChain({ report, chain }));

                    if (result.status === 'rejected') {
                        logger.error({ msg: 'Unwrapping errored', data: { chain, error: result.reason } });
                    }

                    // update the summary
                    report.timing = result.timing;
                    report.summary = {
                        success:
                            report.unwrapTransaction?.status === 'fulfilled' ||
                            (report.unwrapDecision?.status === 'fulfilled' &&
                                !report.unwrapDecision.value.shouldUnwrap),
                        unwrapped: report.unwrapTransaction?.status === 'fulfilled',
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
                        const res = await insertUnwrapReport(report);
                        db_raw_report_id = res.raw_report_id;
                    } catch (e) {
                        logger.error({ msg: 'Failed to insert report into db', data: { chain, error: e } });
                        logger.trace(e);
                        await notifyError({ doing: 'insert unwrap report', data: { chain: report.chain } }, e);
                    }

                    if (chain === 'gnosis') {
                        await notifyUnwrapReport(report, db_raw_report_id);
                    }
                    logger.debug({ msg: 'Unwrap done', data: { chain, db_raw_report_id, notifyUnwrapReport } });

                    return report;
                })
        )
    );
    logger.trace({ msg: 'unwrap results', data: { successfulReports, rejectedReports } });
    const successfulChains = successfulReports.map(r => r.chain);
    logger.info({
        msg: 'unwrapping done',
        data: { successfulChains, rejectedChains: options.chain.filter(c => !successfulChains.includes(c)) },
    });
    if (rejectedReports.length > 0) {
        logger.debug({
            msg: 'Some chains errored',
            data: { count: rejectedReports.length, rejectedReports: rejectedReports.map(r => r + '') },
        });
        for (const rejectedReportError of rejectedReports) {
            logger.error(rejectedReportError);
            try {
                await notifyError({ doing: 'unwrap', data: { chain: rejectedReportError.chain } }, rejectedReportError);
            } catch (e) {
                logger.error({ msg: 'Failed to notify error', data: { chain: rejectedReportError.chain, error: e } });
                logger.trace(e);
            }
        }
    }
}

runMain(withDbClient(main, { appName: 'cowllector-unwrap' }));
