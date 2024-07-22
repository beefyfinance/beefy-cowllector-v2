import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { getReadOnlyRpcClient, getWalletClient } from '../lib/rpc-client';
import { bigintMultiplyFloat } from '../util/bigint';
import { rootLogger } from '../util/logger';
import { getChainWNativeTokenAddress } from './addressbook';
import type { Chain } from './chain';
import { fetchCollectorBalance } from './collector-balance';
import {
    BLIND_HARVEST_EVERY_X_HOURS,
    PLATFORM_IDS_NOTORIOUSLY_SLOW_TO_REFILL_REWARDS,
    RPC_CONFIG,
    SLOW_REFILL_VAULTS_ALERT_AFTER_DAYS,
    STRATEGY_TYPE_IDS_THAT_CAN_BE_SLOW_TO_REFILL_REWARDS,
    VAULT_IDS_NOTORIOUSLY_SLOW_TO_REFILL_REWARDS,
    VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS,
    VAULT_IDS_WE_ARE_OK_NOT_HARVESTING,
    VAULT_IDS_WE_SHOULD_BLIND_HARVEST,
    VAULT_IDS_WITH_MISSING_PROPER_HARVEST_FUNCTION,
} from './config';
import { createGasEstimationReport } from './gas';
import type { HarvestParameters } from './harvest-actions/harvest';
import { UnsupportedChainError } from './harvest-errors';
import {
    type HarvestReport,
    createDefaultHarvestReportItem,
    reportOnMultipleHarvestAsyncCall,
    reportOnSingleHarvestAsyncCall,
} from './harvest-report';
import type { BeefyVault } from './vault';

const logger = rootLogger.child({ module: 'harvest-chain' });

export async function harvestChain({
    report,
    now,
    chain,
    vaults,
}: {
    report: HarvestReport;
    now: Date;
    chain: Chain;
    vaults: BeefyVault[];
}) {
    logger.debug({
        msg: 'Harvesting chain',
        data: { chain, vaults: vaults.length },
    });

    const wnative = getChainWNativeTokenAddress(chain);
    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    const items = vaults.map(vault => ({
        vault,
        report: createDefaultHarvestReportItem({ vault }),
    }));
    report.details = items.map(({ report }) => report);

    // we need the harvest lense
    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${chain}`);
    }
    const harvestLensContract = {
        abi: BeefyHarvestLensABI,
        address: rpcConfig.contracts.harvestLens,
    };

    // ======================
    // get some context first
    // ======================

    const {
        fetchGasPrice: { gasPriceWei: rawGasPrice },
    } = await reportOnSingleHarvestAsyncCall({ report }, 'fetchGasPrice', async () => ({
        gasPriceWei: await publicClient.getGasPrice(),
    }));

    await reportOnSingleHarvestAsyncCall({ report }, 'collectorBalanceBefore', () => fetchCollectorBalance({ chain }));

    // ==================
    // run the simulation
    // ==================
    const successfulSimulations = await reportOnMultipleHarvestAsyncCall(
        items,
        'simulation',
        {
            type: 'parallel-batched',
            batchSize: rpcConfig.harvest.parallelSimulations,
        },
        async item => {
            if (VAULT_IDS_WE_SHOULD_BLIND_HARVEST.includes(item.vault.id)) {
                return {
                    estimatedCallRewardsWei: 0n,
                    harvestWillSucceed: true,
                    lastHarvest: new Date(),
                    hoursSinceLastHarvest: 0,
                    isLastHarvestRecent: true,
                    paused: false,
                    blockNumber: 0n,
                    harvestResultData: '0x',
                    gas: createGasEstimationReport({
                        rawGasPrice,
                        rawGasAmountEstimation: 0n,
                        estimatedCallRewardsWei: 0n,
                        gasPriceMultiplier: 1,
                        minExpectedRewardsWei: 0n,
                    }),
                };
            }

            const {
                result: { callReward, gasUsed, lastHarvest, paused, success, blockNumber, harvestResult },
            } = await publicClient.simulateContractInBatch({
                ...harvestLensContract,
                functionName: 'harvest',
                args: [item.vault.strategyAddress, wnative] as const,
                //account: walletAccount, // setting the account disables multicall batching
            });
            const lastHarvestDate = new Date(Number(lastHarvest) * 1000);
            const timeSinceLastHarvestMs = now.getTime() - lastHarvestDate.getTime();
            const isLastHarvestRecent = timeSinceLastHarvestMs < rpcConfig.harvest.targetTimeBetweenHarvestsMs;
            return {
                estimatedCallRewardsWei: callReward,
                harvestWillSucceed: success,
                lastHarvest: lastHarvestDate,
                hoursSinceLastHarvest: timeSinceLastHarvestMs / 1000 / 60 / 60,
                isLastHarvestRecent,
                paused,
                blockNumber,
                harvestResultData: harvestResult,
                gas: createGasEstimationReport({
                    rawGasPrice,
                    rawGasAmountEstimation: gasUsed,
                    estimatedCallRewardsWei: callReward,
                    gasPriceMultiplier: rpcConfig.harvest.balanceCheck.gasPriceMultiplier,
                    minExpectedRewardsWei: rpcConfig.harvest.profitabilityCheck.minExpectedRewardsWei,
                }),
            };
        }
    );

    // ============================
    // Filter out paused strategies
    // ============================
    // use some kind of logic to filter out strats that we don't want to harvest

    if (chain === 'ethereum') {
        throw new UnsupportedChainError({ chain });
    }
    const shouldHarvestDecisions = await reportOnMultipleHarvestAsyncCall(
        successfulSimulations,
        'decision',
        { type: 'parallel' },
        async item => {
            if (item.vault.eol) {
                return {
                    shouldHarvest: false,
                    level: 'info',
                    notHarvestingReason: 'vault is eol',
                };
            }

            if (item.simulation.paused) {
                return {
                    shouldHarvest: false,
                    level: 'info',
                    notHarvestingReason: 'strategy paused',
                };
            }

            if (item.vault.tvlUsd < rpcConfig.harvest.minTvlThresholdUsd) {
                return {
                    shouldHarvest: false,
                    level: 'info',
                    tvlThresholdUsd: rpcConfig.harvest.minTvlThresholdUsd,
                    vaultTvlUsd: item.vault.tvlUsd,
                    notHarvestingReason: 'Tvl do not meet minimum threshold',
                };
            }

            if (VAULT_IDS_WE_SHOULD_BLIND_HARVEST.includes(item.vault.id)) {
                // to avoid remembering the last harvest time, we harvest at regular interval based on the current time
                const truncatedDate = new Date();
                truncatedDate.setMilliseconds(0);
                truncatedDate.setSeconds(0);
                truncatedDate.setMinutes(0);
                const shouldBlindHarvest =
                    truncatedDate.getTime() % (BLIND_HARVEST_EVERY_X_HOURS * 60 * 60 * 1000) === 0;
                if (shouldBlindHarvest) {
                    return {
                        shouldHarvest: true,
                        blindHarvestDate: truncatedDate,
                        level: 'info',
                    };
                }
                return {
                    shouldHarvest: false,
                    blindHarvestDate: truncatedDate,
                    level: 'info',
                    notHarvestingReason: 'Blind harvest date not reached yet',
                };
            }

            if (item.simulation.harvestWillSucceed === false) {
                if (item.simulation.isLastHarvestRecent) {
                    return {
                        shouldHarvest: false,
                        level: 'info',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        notHarvestingReason:
                            'harvested would fail but the vault was harvested recently, there is probably no rewards to swap',
                    };
                }

                if (VAULT_IDS_WITH_MISSING_PROPER_HARVEST_FUNCTION.includes(item.vault.id)) {
                    return {
                        shouldHarvest: false,
                        level: 'info',
                        notHarvestingReason:
                            'vault not compatible with lens: missing `harvest(address recipient)` function',
                    };
                }

                if (item.vault.platformId === 'gamma') {
                    return {
                        shouldHarvest: false,
                        level: 'info',
                        notHarvestingReason:
                            'harvest would fail but it is a gamma vault so it might just be out of range',
                    };
                }

                if (VAULT_IDS_WE_ARE_OK_NOT_HARVESTING.includes(item.vault.id)) {
                    return {
                        shouldHarvest: false,
                        level: 'notice',
                        harvestReturnData: item.simulation.harvestResultData,
                        blockNumber: item.simulation.blockNumber,
                        notHarvestingReason: 'We are ok not harvesting this vault',
                    };
                }

                return {
                    shouldHarvest: false,
                    level: 'error',
                    notHarvestingReason: 'harvest would fail',
                    harvestReturnData: item.simulation.harvestResultData,
                    blockNumber: item.simulation.blockNumber,
                };
            }

            if (item.simulation.estimatedCallRewardsWei === 0n) {
                if (item.simulation.isLastHarvestRecent) {
                    return {
                        shouldHarvest: false,
                        level: 'info',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        notHarvestingReason: 'estimated call rewards is 0, but vault harvested recently',
                    };
                }

                if (VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS.includes(item.vault.id)) {
                    return {
                        shouldHarvest: false,
                        level: 'info',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        notHarvestingReason: 'estimated call rewards is 0, but this is ok for this vault',
                    };
                }

                if (
                    (VAULT_IDS_NOTORIOUSLY_SLOW_TO_REFILL_REWARDS.includes(item.vault.id) ||
                        PLATFORM_IDS_NOTORIOUSLY_SLOW_TO_REFILL_REWARDS.includes(item.vault.platformId) ||
                        (item.vault.strategyTypeId &&
                            STRATEGY_TYPE_IDS_THAT_CAN_BE_SLOW_TO_REFILL_REWARDS.includes(
                                item.vault.strategyTypeId
                            ))) &&
                    item.simulation.hoursSinceLastHarvest < 24 * SLOW_REFILL_VAULTS_ALERT_AFTER_DAYS
                ) {
                    return {
                        shouldHarvest: false,
                        level: 'notice',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        mightNeedEOL: true,
                        notHarvestingReason:
                            'estimated call rewards is 0, but this vault is notoriously slow to refill rewards',
                    };
                }

                if (VAULT_IDS_WE_ARE_OK_NOT_HARVESTING.includes(item.vault.id)) {
                    return {
                        shouldHarvest: false,
                        level: 'notice',
                        harvestReturnData: item.simulation.harvestResultData,
                        blockNumber: item.simulation.blockNumber,
                        notHarvestingReason: 'We are ok not harvesting this vault',
                    };
                }

                return {
                    shouldHarvest: false,
                    level: 'error',
                    hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                    mightNeedEOL: true,
                    notHarvestingReason: 'estimated call rewards is 0 and vault has not been harvested in a long time',
                };
            }

            if (
                rpcConfig.transaction.maxNativePerTransactionWei &&
                item.simulation.gas.transactionCostEstimationWei > rpcConfig.transaction.maxNativePerTransactionWei
            ) {
                return {
                    shouldHarvest: false,
                    level:
                        item.simulation.hoursSinceLastHarvest > rpcConfig.alerting.networkCongestionWaitInDays * 24
                            ? 'error'
                            : 'warning',
                    maxNativePerTransactionWei: rpcConfig.transaction.maxNativePerTransactionWei,
                    transactionCostEstimationWei: item.simulation.gas.transactionCostEstimationWei,
                    notHarvestingReason:
                        'estimated transaction cost would be too high, waiting until the network is less congested',
                };
            }

            if (
                rpcConfig.transaction.maxGasPricePerTransactionWei &&
                item.simulation.gas.gasPrice > rpcConfig.transaction.maxGasPricePerTransactionWei
            ) {
                return {
                    shouldHarvest: false,
                    level:
                        item.simulation.hoursSinceLastHarvest > rpcConfig.alerting.networkCongestionWaitInDays * 24
                            ? 'error'
                            : 'warning',
                    maxGasPricePerTransactionWei: rpcConfig.transaction.maxGasPricePerTransactionWei,
                    gasPrice: item.simulation.gas.gasPrice,
                    notHarvestingReason:
                        'estimated gas price would be too high, waiting until the network is less congested',
                };
            }

            // l2s like optimism are more difficult to estimate gas price for since they have additional l1 fees
            // so we removed our profitability check for now
            if (item.simulation.gas.wouldBeProfitable) {
                if (rpcConfig.harvest.profitabilityCheck.enabled) {
                    return {
                        shouldHarvest: true,
                        level: 'info',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        wouldBeProfitable: item.simulation.gas.wouldBeProfitable,
                        callRewardsWei: item.simulation.estimatedCallRewardsWei,
                        estimatedGainWei: item.simulation.gas.estimatedGainWei,
                    };
                }
                logger.info({
                    msg: 'Harvesting would probably be profitable if we computed gas cost correctly. But we are not so we are not harvesting.',
                    data: {
                        gasEstimation: item.simulation.gas,
                        simulation: item.simulation,
                    },
                });
            }

            if (item.simulation.isLastHarvestRecent) {
                return {
                    shouldHarvest: false,
                    level: 'info',
                    hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                    wouldBeProfitable: item.simulation.gas.wouldBeProfitable,
                    callRewardsWei: item.simulation.estimatedCallRewardsWei,
                    estimatedGainWei: item.simulation.gas.estimatedGainWei,
                    notHarvestingReason: 'harvested too recently',
                };
            }

            return {
                shouldHarvest: true,
                level: 'info',
                hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                wouldBeProfitable: item.simulation.gas.wouldBeProfitable,
                callRewardsWei: item.simulation.estimatedCallRewardsWei,
                estimatedGainWei: item.simulation.gas.estimatedGainWei,
            };
        }
    );
    const stratsToBeHarvested = shouldHarvestDecisions.filter(item => item.decision.shouldHarvest);

    // =======================
    // now do the havest dance
    // =======================

    logger.debug({
        msg: 'Harvesting strats',
        data: { chain, count: stratsToBeHarvested.length },
    });
    await reportOnMultipleHarvestAsyncCall(stratsToBeHarvested, 'transaction', { type: 'sequential' }, async item => {
        let harvestParams: HarvestParameters = {
            strategyAddress: item.vault.strategyAddress,
            // mode fails to estimate gas because their eth_estimateGas method doesn't accept fee params
            // and removing those in view is near impossible
            transactionCostEstimationWei: chain === 'mode' ? item.simulation.gas.transactionCostEstimationWei : null,
            transactionGasLimit: null,
        };

        if (!VAULT_IDS_WE_SHOULD_BLIND_HARVEST.includes(item.vault.id) && rpcConfig.harvest.setTransactionGasLimit) {
            harvestParams = {
                strategyAddress: item.vault.strategyAddress,
                transactionCostEstimationWei: item.simulation.gas.transactionCostEstimationWei,
                transactionGasLimit: bigintMultiplyFloat(
                    item.simulation.gas.rawGasAmountEstimation,
                    rpcConfig.harvest.balanceCheck.gasLimitMultiplier
                ),
            };
        }

        const res = await walletClient.harvest(harvestParams);

        return {
            ...res,
            // todo: this shouldn't be an estimate
            estimatedProfitWei: item.simulation.gas.estimatedGainWei - item.simulation.gas.transactionCostEstimationWei,
        };
    });

    // ===============
    // final reporting
    // ===============

    // fetching this additional info shouldn't crash the whole harvest
    try {
        await reportOnSingleHarvestAsyncCall({ report }, 'collectorBalanceAfter', () =>
            fetchCollectorBalance({ chain })
        );
    } catch (e) {
        logger.error({
            msg: 'Error getting collector balance after',
            data: { chain, e },
        });
    }

    return report;
}
