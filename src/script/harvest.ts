import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../lib/chain';
import type { Chain } from '../lib/chain';
import { rootLogger } from '../util/logger';
import { getVaultsToMonitorByChain } from '../lib/vault-list';
import { harvestChain } from '../lib/harvest-chain';
import { Hex } from 'viem';
import { createDefaultHarvestReport } from '../lib/harvest-report';
import { splitPromiseResultsByStatus } from '../util/promise';
import { asyncResultGet, promiseTimings } from '../util/async';
import { notifyHarvestReport } from '../lib/notify';
import { DISABLE_COLLECTOR_FOR_CHAINS, RPC_CONFIG } from '../lib/config';
import {
    ReportAsyncStatusContext,
    getMergedReportAsyncStatus,
    getReportAsyncStatus,
    getReportAsyncStatusCounts,
} from '../lib/report-error-status';
import { withDbClient } from '../lib/db/utils';
import { insertHarvestReports } from '../lib/db/db-report';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain[];
    strategyAddress: Hex | null;
    now: Date;
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
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
        strategyAddress: (argv['strategy-address'] || null) as Hex | null,
        now: argv.now ? new Date(argv.now) : new Date(Date.now()),
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
                .filter(([_, vaults]) => vaults.length > 0)

                .map(async ([chain, vaults]) => {
                    // create the report objects
                    let report = createDefaultHarvestReport({ chain });
                    const result = await promiseTimings(() =>
                        harvestChain({ report, now: options.now, chain: chain as Chain, vaults })
                    );

                    if (result.status === 'rejected') {
                        logger.error({ msg: 'Harvesting errored', data: { chain, error: result.reason } });
                        logger.trace(result.reason);
                    }

                    // update the summary
                    report.timing = result.timing;
                    report.details.forEach(item => {
                        const trxStatus = getReportAsyncStatus({ chain, vault: item.vault }, item.transaction);
                        item.summary = {
                            harvested: trxStatus === 'success',
                            skipped: trxStatus === 'not-started',
                            status: getMergedReportAsyncStatus<any>({ chain, vault: item.vault }, [
                                item.simulation,
                                item.decision,
                                item.transaction,
                            ]),
                            estimatedProfitWei:
                                item.transaction?.status === 'fulfilled'
                                    ? item.transaction?.value.estimatedProfitWei
                                    : 0n,
                        };
                    });

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

                    await notifyHarvestReport(report);

                    await insertHarvestReports([report]);

                    return report;
                })
        )
    );
    logger.trace({ msg: 'harvest results', data: { successfulReports, rejectedReports } });
    const successfulChains = successfulReports.map(r => r.chain);
    logger.info({
        msg: 'Harvesting done',
        data: { successfulChains, rejectedChains: options.chain.filter(c => !successfulChains.includes(c)) },
    });
    if (rejectedReports.length > 0) {
        logger.debug({
            msg: 'Some chains errored',
            data: { count: rejectedReports.length, rejectedReports: rejectedReports.map(r => r + '') },
        });
        for (const rejectedReport of rejectedReports) {
            logger.error(rejectedReport);
        }
    }
}

runMain(withDbClient(main, { appName: 'cowllector-harvest' }));
