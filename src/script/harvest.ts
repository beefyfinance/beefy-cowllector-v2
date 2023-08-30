import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../lib/chain';
import type { Chain } from '../lib/chain';
import { rootLogger } from '../util/logger';
import { getVaultsToMonitor } from '../lib/vault-list';
import { harvestChain } from '../lib/harvest-chain';
import { Hex } from 'viem';
import { createDefaultHarvestReport } from '../lib/harvest-report';
import { splitPromiseResultsByStatus } from '../util/promise';
import { asyncResultGet, promiseTimings } from '../util/async';
import { notifyHarvestReport } from '../lib/notify';
import { DISABLE_COLLECTOR_FOR_CHAINS } from '../lib/config';
import { ReportAsyncStatus, getMergedReportAsyncStatus, getReportAsyncStatus } from '../lib/report-error-status';
import { countBy, merge } from 'lodash';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain[];
    contractAddress: Hex | null;
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
        'contract-address': {
            type: 'string',
            demand: false,
            alias: 'a',
            describe: 'only harvest for this contract address',
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
        contractAddress: (argv['contract-address'] || null) as Hex | null,
        now: argv.now ? new Date(argv.now) : new Date(Date.now()),
    };
    logger.trace({ msg: 'running with options', data: options });

    // fetch vaults from beefy api
    const vaultsByChain = await getVaultsToMonitor({ chains: options.chain, contractAddress: options.contractAddress });

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
                        item.summary = {
                            harvested: getReportAsyncStatus({ chain }, item.transaction) === 'success',
                            skipped: getReportAsyncStatus({ chain }, item.transaction) === 'not-started',
                            status: getMergedReportAsyncStatus<any>({ chain }, [
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

                    report.summary = {
                        statuses: merge(
                            {
                                error: 0,
                                'not-started': 0,
                                'silent-error': 0,
                                warning: 0,
                                success: 0,
                            },
                            countBy(report.details, item => item.summary.status)
                        ) as Record<ReportAsyncStatus, number>,
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

runMain(main);
