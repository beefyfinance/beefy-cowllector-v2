import { getAddress } from 'viem';
import { BeefyHarvestLensV1ABI } from '../abi/BeefyHarvestLensV1ABI';
import { BeefyHarvestLensV2ABI } from '../abi/BeefyHarvestLensV2ABI';
import { BeefyHarvestLensV3ABI } from '../abi/BeefyHarvestLensV3ABI';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { bigintMultiplyFloat } from '../util/bigint';
import { rootLogger } from '../util/logger';
import { getChainFeesTokenAddress } from './addressbook';
import type { Chain } from './chain';
import { fetchCollectorBalance } from './collector-balance';
import {
    BLIND_HARVEST_EVERY_X_HOURS,
    CHAINS_WE_SHOULD_BLIND_HARVEST,
    GASLESS_CHAIN_IDS,
    RPC_CONFIG,
    SILENCE_NOT_CALM_ERRORS_FOR_HOURS,
    SLOW_REWARD_WAIT_IN_HOURS,
    VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS,
    VAULT_IDS_WE_ARE_OK_NOT_HARVESTING,
    VAULT_IDS_WE_KNOW_HAVE_REWARDS_BUT_IS_NOT_TELLING_US,
    VAULT_IDS_WE_NEED_TO_HARVEST_NO_PARAMS,
    VAULT_IDS_WE_SHOULD_BLIND_HARVEST,
    VAULT_IDS_WITH_MISSING_PROPER_HARVEST_FUNCTION,
} from './config';
import { createGasEstimationReport } from './gas';
import type { HarvestParameters } from './harvest-actions/harvest';
import {
    type HarvestReport,
    createDefaultHarvestReportItem,
    reportOnMultipleHarvestAsyncCall,
    reportOnSingleHarvestAsyncCall,
} from './harvest-report';
import { getHarvestTimeBucket } from './should-harvest';
import type { BeefyVault } from './vault';

const logger = rootLogger.child({ module: 'harvest-chain' });

export async function harvestChain({
    report,
    now,
    chain,
    vaults,
    dryRun,
}: {
    report: HarvestReport;
    now: Date;
    chain: Chain;
    vaults: BeefyVault[];
    dryRun: boolean;
}) {
    logger.debug({
        msg: 'Harvesting chain',
        data: { chain, vaults: vaults.length },
    });

    const fees = getChainFeesTokenAddress(chain);
    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
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
        abi:
            rpcConfig.contracts.harvestLens.kind === 'v1'
                ? BeefyHarvestLensV1ABI
                : rpcConfig.contracts.harvestLens.kind === 'v2'
                  ? BeefyHarvestLensV2ABI
                  : BeefyHarvestLensV3ABI,
        address: rpcConfig.contracts.harvestLens.address,
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
                    isLastHarvestRecent: null,
                    harvestTimeBucket: null as {
                        minTvlThresholdUsd: number;
                        targetTimeBetweenHarvestsMs: number;
                    } | null,
                    isCalmBeforeHarvest: -1,
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

            const noParams =
                VAULT_IDS_WE_NEED_TO_HARVEST_NO_PARAMS.includes(item.vault.id) &&
                rpcConfig.contracts.harvestLens?.kind === 'v3';

            const { result } = await publicClient.simulateContractInBatch({
                ...harvestLensContract,
                functionName: noParams ? 'harvestNoParams' : 'harvest',
                args: [getAddress(item.vault.strategyAddress), getAddress(fees)] as const,
                // setting the account disables multicall batching unless we use our custom simulateContractInBatch function
                // moreover, the lens contract is setup so that it sends back any fees to the caller
                // so we need to set the account anyway to avoid 0xec442f05 error (ERC20InvalidReceiver)
                // as without a wallet account, the lens contract will send the fees back to address(0)
                account: walletAccount,
            });
            const lastHarvestDate = new Date(Number(result.lastHarvest) * 1000);
            const timeSinceLastHarvestMs = now.getTime() - lastHarvestDate.getTime();
            const harvestTimeBucket = getHarvestTimeBucket({
                vault: item.vault,
                rpcConfig,
            });
            const isLastHarvestRecent = harvestTimeBucket?.targetTimeBetweenHarvestsMs
                ? timeSinceLastHarvestMs < harvestTimeBucket.targetTimeBetweenHarvestsMs
                : true;
            const isCalmBeforeHarvest = 'isCalmBeforeHarvest' in result ? result.isCalmBeforeHarvest : -1;

            return {
                estimatedCallRewardsWei: result.callReward,
                harvestWillSucceed: result.success,
                lastHarvest: lastHarvestDate,
                hoursSinceLastHarvest: timeSinceLastHarvestMs / 1000 / 60 / 60,
                isLastHarvestRecent,
                harvestTimeBucket,
                isCalmBeforeHarvest,
                paused: result.paused,
                blockNumber: result.blockNumber,
                harvestResultData: result.harvestResult,
                gas: createGasEstimationReport({
                    rawGasPrice,
                    rawGasAmountEstimation: result.gasUsed,
                    estimatedCallRewardsWei: result.callReward,
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

            // TVL checks
            if (item.simulation.harvestTimeBucket === null) {
                return {
                    shouldHarvest: false,
                    level: 'info',
                    tvlThresholdUsd: 0,
                    vaultTvlUsd: item.vault.tvlUsd,
                    notHarvestingReason: 'Tvl do not meet minimum threshold',
                };
            }

            const blindHarvestChainConfig = CHAINS_WE_SHOULD_BLIND_HARVEST.find(c => c.chain === chain);
            if (blindHarvestChainConfig) {
                // to avoid remembering the last harvest time, we harvest at regular interval based on the current time
                // this might not work if we are not running the harvest script every hour
                const truncatedDate = new Date();
                truncatedDate.setMilliseconds(0);
                truncatedDate.setSeconds(0);
                truncatedDate.setMinutes(0);
                const shouldBlindHarvest =
                    truncatedDate.getTime() % (blindHarvestChainConfig.blindHarvestEveryXHours * 60 * 60 * 1000) === 0;
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
                const raisedNotCalmError = item.simulation.harvestResultData
                    .toLocaleLowerCase()
                    .startsWith('0x26c87876');
                if (raisedNotCalmError && item.simulation.isCalmBeforeHarvest === 1) {
                    return {
                        shouldHarvest: false,
                        level: 'error',
                        notHarvestingReason: 'Harvesting makes the vault NotCalm(), manual intervention required',
                    };
                }

                if (raisedNotCalmError) {
                    const isError =
                        item.simulation.hoursSinceLastHarvest > SILENCE_NOT_CALM_ERRORS_FOR_HOURS * 60 * 60 * 1000;
                    return {
                        shouldHarvest: false,
                        level: isError ? 'error' : 'info',
                        notHarvestingReason: 'harvest would raise a NotCalm() error, can not harvest',
                    };
                }

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

                if (item.vault.platformId === 'aura') {
                    return {
                        shouldHarvest: false,
                        level: 'error',
                        notHarvestingReason:
                            'harvest would fail but it is an aura vault, so it might just be out of rewards',
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

            if (
                !VAULT_IDS_WE_KNOW_HAVE_REWARDS_BUT_IS_NOT_TELLING_US.includes(item.vault.id) &&
                item.simulation.estimatedCallRewardsWei === 0n
            ) {
                if (item.simulation.isLastHarvestRecent) {
                    return {
                        shouldHarvest: false,
                        level: 'info',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        notHarvestingReason: 'estimated call rewards is 0, but vault harvested recently',
                    };
                }

                // estimated call rewards is 0, we do not pay for gas on this chain so lets harvest anyway
                if (GASLESS_CHAIN_IDS.includes(chain)) {
                    return {
                        shouldHarvest: true,
                        level: 'info',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        callRewardsWei: item.simulation.estimatedCallRewardsWei,
                        estimatedGainWei: item.simulation.gas.estimatedGainWei,
                        wouldBeProfitable: item.simulation.gas.wouldBeProfitable,
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
                    (SLOW_REWARD_WAIT_IN_HOURS.vault[item.vault.id] &&
                        item.simulation.hoursSinceLastHarvest < SLOW_REWARD_WAIT_IN_HOURS.vault[item.vault.id]) ||
                    (SLOW_REWARD_WAIT_IN_HOURS.platform[item.vault.platformId] &&
                        item.simulation.hoursSinceLastHarvest <
                            SLOW_REWARD_WAIT_IN_HOURS.platform[item.vault.platformId]) ||
                    (item.vault.strategyTypeId &&
                        SLOW_REWARD_WAIT_IN_HOURS.strategyTypeId[item.vault.strategyTypeId] &&
                        item.simulation.hoursSinceLastHarvest <
                            SLOW_REWARD_WAIT_IN_HOURS.strategyTypeId[item.vault.strategyTypeId])
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

                if (item.vault.isClmVault) {
                    return {
                        shouldHarvest: false,
                        level: 'notice',
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        blockNumber: item.simulation.blockNumber,
                        notHarvestingReason:
                            'estimated call rewards is 0, but this is ok as the underlying manager is a CLM and users are still earning rewards',
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

            if (
                VAULT_IDS_WE_NEED_TO_HARVEST_NO_PARAMS.includes(item.vault.id) &&
                rpcConfig.contracts.harvestLens?.kind !== 'v3'
            ) {
                return {
                    shouldHarvest: false,
                    level: 'error',
                    notHarvestingReason:
                        'vault needs to be harvested with the no params version but the lens is not v3, please update the lens',
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

    if (dryRun) {
        logger.debug({
            msg: 'Dry run, skipping harvest',
            data: { chain, count: stratsToBeHarvested.length },
        });
        return report;
    }

    logger.debug({
        msg: 'Harvesting strats',
        data: { chain, count: stratsToBeHarvested.length },
    });
    await reportOnMultipleHarvestAsyncCall(stratsToBeHarvested, 'transaction', { type: 'sequential' }, async item => {
        const noParams =
            VAULT_IDS_WE_NEED_TO_HARVEST_NO_PARAMS.includes(item.vault.id) &&
            rpcConfig.contracts.harvestLens?.kind === 'v3';

        let harvestParams: HarvestParameters = {
            strategyAddress: item.vault.strategyAddress,
            // mode fails to estimate gas because their eth_estimateGas method doesn't accept fee params
            // and removing those in view is near impossible
            transactionCostEstimationWei: chain === 'mode' ? item.simulation.gas.transactionCostEstimationWei : null,
            transactionGasLimit: null,
            noParams,
        };

        if (!VAULT_IDS_WE_SHOULD_BLIND_HARVEST.includes(item.vault.id) && rpcConfig.harvest.setTransactionGasLimit) {
            harvestParams = {
                strategyAddress: item.vault.strategyAddress,
                transactionCostEstimationWei: item.simulation.gas.transactionCostEstimationWei,
                transactionGasLimit: bigintMultiplyFloat(
                    item.simulation.gas.rawGasAmountEstimation,
                    rpcConfig.harvest.balanceCheck.gasLimitMultiplier
                ),
                noParams,
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
