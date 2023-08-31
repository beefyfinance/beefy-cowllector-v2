import type { Chain } from './chain';
import type { BeefyVault } from './vault';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import {
    HARVEST_AT_LEAST_EVERY_HOURS,
    HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER,
    HARVEST_GAS_PRICE_MULTIPLIER,
    RPC_CONFIG,
    VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS,
} from './config';
import { rootLogger } from '../util/logger';
import { createGasEstimationReport } from './gas';
import {
    HarvestReport,
    createDefaultHarvestReportItem,
    reportOnMultipleHarvestAsyncCall,
    reportOnSingleHarvestAsyncCall,
} from './harvest-report';
import { UnsupportedChainError } from './harvest-errors';
import { fetchCollectorBalance } from './collector-balance';
import { bigintMultiplyFloat } from '../util/bigint';
import { getChainWNativeTokenAddress } from './addressbook';
import { IStrategyABI } from '../abi/IStrategyABI';
import { extractErrorMessage } from './error-message';

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
    logger.debug({ msg: 'Harvesting chain', data: { chain, vaults: vaults.length } });

    const wnative = getChainWNativeTokenAddress(chain);
    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    const items = vaults.map(vault => ({ vault, report: createDefaultHarvestReportItem({ vault }) }));
    report.details = items.map(({ report }) => report);

    // we need the harvest lense
    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${chain}`);
    }
    const harvestLensContract = { abi: BeefyHarvestLensABI, address: rpcConfig.contracts.harvestLens };

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
        'parallel',
        async item => {
            const {
                result: { callReward, gasUsed, lastHarvest, paused, success },
            } = await publicClient.simulateContract({
                ...harvestLensContract,
                functionName: 'harvest',
                args: [item.vault.strategyAddress, wnative] as const,
                account: walletAccount,
            });
            const lastHarvestDate = new Date(Number(lastHarvest) * 1000);
            const hoursSinceLastHarvest = (now.getTime() - lastHarvestDate.getTime()) / 1000 / 60 / 60;
            const isLastHarvestRecent = hoursSinceLastHarvest < HARVEST_AT_LEAST_EVERY_HOURS;
            return {
                estimatedCallRewardsWei: callReward,
                harvestWillSucceed: success,
                lastHarvest: lastHarvestDate,
                hoursSinceLastHarvest,
                isLastHarvestRecent,
                paused,
                gas: createGasEstimationReport({
                    rawGasPrice,
                    rawGasAmountEstimation: gasUsed,
                    estimatedCallRewardsWei: callReward,
                    gasPriceMultiplier: HARVEST_GAS_PRICE_MULTIPLIER,
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
        'parallel',
        async item => {
            if (item.vault.tvlUsd < rpcConfig.tvl.minThresholdUsd) {
                return {
                    shouldHarvest: false,
                    level: 'info',
                    tvlThresholdUsd: rpcConfig.tvl.minThresholdUsd,
                    vaultTvlUsd: item.vault.tvlUsd,
                    notHarvestingReason: 'Tvl do not meet minimum threshold',
                };
            }

            if (item.simulation.harvestWillSucceed === false) {
                // this is a temporary fix while we have a more robust solution
                // TODO: have the lens handle cases where the strat only has an `harvest()` function
                if (
                    (chain === 'arbitrum' && item.vault.id === 'sushi-arb-eth-usdc') ||
                    (chain === 'arbitrum' && item.vault.id === 'sushi-arb-magic-weth') ||
                    (chain === 'avax' && item.vault.id === 'curve-avax-atricrypto') ||
                    (chain === 'polygon' && item.vault.id === 'curve-am3crv') ||
                    (chain === 'polygon' && item.vault.id === 'telxchange-quick-aave-tel')
                ) {
                    return {
                        shouldHarvest: false,
                        level: 'notice',
                        notHarvestingReason:
                            'vault not compatible with lens: missing `harvest(address recipient)` function',
                    };
                }

                if (item.vault.platformId === 'gamma') {
                    return {
                        shouldHarvest: false,
                        level: 'notice',
                        notHarvestingReason:
                            'harvest would fail but it is a gamma vault so it might just be out of range',
                    };
                }

                // here we know that the harvest will fail but we don't know why
                // since the lens doesn't tell us
                // so we simulate the harvest directly to get the revert reason
                try {
                    await publicClient.simulateContract({
                        abi: IStrategyABI,
                        address: item.vault.strategyAddress,
                        functionName: 'harvest',
                        args: [walletAccount.address],
                        account: walletAccount,
                    });
                    return {
                        shouldHarvest: false,
                        level: 'error',
                        notHarvestingReason: 'lens simulation failed but harvest simulation succeeded',
                    };
                } catch (e) {
                    return {
                        shouldHarvest: false,
                        level: 'error',
                        notHarvestingReason: 'harvest would fail',
                        harvestError: extractErrorMessage(e),
                    };
                }
            }

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

            if (item.simulation.estimatedCallRewardsWei === 0n) {
                if (item.simulation.isLastHarvestRecent) {
                    return {
                        shouldHarvest: false,
                        level: 'notice',
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

                return {
                    shouldHarvest: false,
                    level: 'warning',
                    hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                    notHarvestingReason: 'estimated call rewards is 0 and vault has not been harvested in a long time',
                };
            }

            // l2s like optimism are more difficult to estimate gas price for since they have additional l1 fees
            // so we removed our profitability check for now
            if (item.simulation.gas.wouldBeProfitable) {
                logger.info({
                    msg: 'Harvesting would probably be profitable if we computed gas cost correctly. But we are not so we are not harvesting.',
                    data: { gasEstimation: item.simulation.gas, simulation: item.simulation },
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

    logger.debug({ msg: 'Harvesting strats', data: { chain, count: stratsToBeHarvested.length } });
    await reportOnMultipleHarvestAsyncCall(stratsToBeHarvested, 'transaction', 'sequential', async item => {
        const res = await walletClient.harvest({
            strategyAddress: item.vault.strategyAddress,
            transactionCostEstimationWei: item.simulation.gas.transactionCostEstimationWei,
            transactionGasLimit: bigintMultiplyFloat(
                item.simulation.gas.rawGasAmountEstimation,
                HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER
            ),
        });

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
        logger.error({ msg: 'Error getting collector balance after', data: { chain, e } });
    }

    return report;
}
