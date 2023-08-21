import type { Chain } from './chain';
import type { BeefyVault } from './vault';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { HARVEST_AT_LEAST_EVERY_HOURS, HARVEST_OVERESTIMATE_GAS_BY_PERCENT, RPC_CONFIG } from './config';
import { rootLogger } from '../util/logger';
import { createGasEstimationReport, estimateHarvestCallGasAmount } from './gas';
import { reportOnHarvestStep, reportOnAsyncCall, HarvestReport, createDefaultReportItem } from './harvest-report';
import { IStrategyABI } from '../abi/IStrategyABI';
import { NotEnoughRemainingGasError, UnsupportedChainError } from './harvest-errors';
import { getChainWNativeTokenAddress } from './addressbook';
import { WnativeABI } from '../abi/WnativeABI';

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

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    const items = vaults.map(vault => ({ vault, report: createDefaultReportItem({ vault }) }));
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
    } = await reportOnAsyncCall({ report }, 'fetchGasPrice', async () => ({
        gasPriceWei: await publicClient.getGasPrice(),
    }));

    await reportOnAsyncCall({ report }, 'collectorBalanceBefore', async () => {
        const [balanceWei, wnativeBalanceWei] = await Promise.all([
            publicClient.getBalance({ address: walletAccount.address }),
            publicClient.readContract({
                abi: WnativeABI,
                address: getChainWNativeTokenAddress(chain),
                functionName: 'balanceOf',
                args: [walletAccount.address],
            }),
        ]);
        return { balanceWei, wnativeBalanceWei, aggregatedBalanceWei: balanceWei + wnativeBalanceWei };
    });

    // ==================
    // run the simulation
    // ==================
    const successfulSimulations = await reportOnHarvestStep(items, 'simulation', 'parallel', async item => {
        const { result } = await publicClient.simulateContract({
            ...harvestLensContract,
            functionName: 'harvest',
            args: [item.vault.strategy_address],
        });
        const [estimatedCallRewardsWei, harvestWillSucceed, rawLastHarvest, strategyPaused] = result;
        const lastHarvest = new Date(Number(rawLastHarvest) * 1000);
        const hoursSinceLastHarvest = (now.getTime() - lastHarvest.getTime()) / 1000 / 60 / 60;
        const isLastHarvestRecent = hoursSinceLastHarvest < HARVEST_AT_LEAST_EVERY_HOURS;
        return {
            estimatedCallRewardsWei,
            harvestWillSucceed,
            lastHarvest,
            hoursSinceLastHarvest,
            isLastHarvestRecent,
            paused: strategyPaused,
        };
    });

    // ============================
    // Filter out paused strategies
    // ============================
    // use some kind of logic to filter out strats that we don't want to harvest

    if (chain === 'ethereum') {
        throw new UnsupportedChainError({ chain });
    }
    const liveStratsDecisions = await reportOnHarvestStep(
        successfulSimulations,
        'isLiveDecision',
        'parallel',
        async item => {
            if (item.simulation.harvestWillSucceed === false) {
                return {
                    shouldHarvest: false,
                    warning: true,
                    notHarvestingReason: 'harvest would fail',
                };
            }

            if (item.vault.eol) {
                return {
                    shouldHarvest: false,
                    warning: false,
                    notHarvestingReason: 'vault is eol',
                };
            }

            if (item.simulation.paused) {
                return {
                    shouldHarvest: false,
                    warning: false,
                    notHarvestingReason: 'strategy paused',
                };
            }

            if (item.simulation.estimatedCallRewardsWei === 0n) {
                if (item.simulation.isLastHarvestRecent) {
                    return {
                        shouldHarvest: false,
                        warning: false,
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        notHarvestingReason: 'estimated call rewards is 0',
                    };
                } else {
                    return {
                        shouldHarvest: false,
                        warning: true,
                        hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                        notHarvestingReason:
                            'estimated call rewards is 0 and vault has not been harvested in a long time',
                    };
                }
            }

            return { shouldHarvest: true, warning: false };
        }
    );
    const liveStrats = liveStratsDecisions.filter(item => item.isLiveDecision.shouldHarvest);

    // ==============
    // Gas Estimation
    // ==============

    const successfulEstimations = await reportOnHarvestStep(liveStrats, 'gasEstimation', 'sequential', async item => {
        const gasEst = await estimateHarvestCallGasAmount({
            chain,
            rpcClient: publicClient,
            strategyAddress: item.vault.strategy_address,
        });
        return createGasEstimationReport({
            rawGasPrice,
            rawGasAmountEstimation: gasEst,
            estimatedCallRewardsWei: item.simulation.estimatedCallRewardsWei,
            overestimateGasByPercent: HARVEST_OVERESTIMATE_GAS_BY_PERCENT,
        });
    });

    // ======================
    // profitability decision
    // ======================
    // check for last harvest and profitability

    const harvestDecisions = await reportOnHarvestStep(
        successfulEstimations,
        'harvestDecision',
        'parallel',
        async item => {
            const shouldHarvest = item.gasEstimation.wouldBeProfitable || !item.simulation.isLastHarvestRecent;

            if (!shouldHarvest) {
                return {
                    shouldHarvest: false,
                    hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                    wouldBeProfitable: item.gasEstimation.wouldBeProfitable,
                    callRewardsWei: item.gasEstimation.estimatedCallRewardsWei,
                    estimatedGainWei: item.gasEstimation.estimatedGainWei,
                    notHarvestingReason: 'not profitable and harvested too recently',
                };
            } else {
                return {
                    shouldHarvest: true,
                    hoursSinceLastHarvest: item.simulation.hoursSinceLastHarvest,
                    wouldBeProfitable: item.gasEstimation.wouldBeProfitable,
                    callRewardsWei: item.gasEstimation.estimatedCallRewardsWei,
                    estimatedGainWei: item.gasEstimation.estimatedGainWei,
                };
            }
        }
    );
    const stratsToBeHarvested = harvestDecisions.filter(item => item.harvestDecision.shouldHarvest);

    // =======================
    // now do the havest dance
    // =======================

    logger.debug({ msg: 'Harvesting strats', data: { chain, count: stratsToBeHarvested.length } });
    await reportOnHarvestStep(stratsToBeHarvested, 'harvestTransaction', 'sequential', async item => {
        // check if we have enough gas to harvest
        logger.trace({ msg: 'Checking gas', data: { chain, strat: item } });
        const remainingGasWei = await publicClient.getBalance({ address: walletAccount.address });
        if (remainingGasWei < item.gasEstimation.transactionCostEstimationWei) {
            logger.info({ msg: 'Not enough gas to harvest', data: { chain, remainingGasWei, strat: item } });
            const error = new NotEnoughRemainingGasError({
                chain,
                remainingGasWei,
                transactionCostEstimationWei: item.gasEstimation.transactionCostEstimationWei,
                strategyAddress: item.vault.strategy_address,
            });
            throw error;
        }
        logger.debug({ msg: 'Enough gas to harvest', data: { chain, remainingGasWei, strat: item } });

        // harvest the strat
        // no need to set gas fees as viem has automatic EIP-1559 detection and gas settings
        // https://github.com/wagmi-dev/viem/blob/viem%401.6.0/src/utils/transaction/prepareRequest.ts#L89
        logger.trace({ msg: 'Harvesting strat', data: { chain, strat: item } });
        const transactionHash = await walletClient.writeContract({
            abi: IStrategyABI,
            address: item.vault.strategy_address,
            functionName: 'harvest',
        });
        logger.debug({ msg: 'Harvested strat', data: { chain, strat: item, transactionHash } });

        // wait for the transaction to be mined so we have a proper nonce for the next transaction
        logger.trace({ msg: 'Waiting for transaction receipt', data: { chain, strat: item, transactionHash } });
        const receipt = await publicClient.waitForTransactionReceipt({
            hash: transactionHash,
            confirmations: rpcConfig.transaction.blockConfirmations,
            timeout: rpcConfig.transaction.timeoutMs,
            pollingInterval: rpcConfig.transaction.pollingIntervalMs,
        });
        logger.debug({ msg: 'Got transaction receipt', data: { chain, strat: item, transactionHash, receipt } });

        // now we officially harvested the strat
        logger.info({ msg: 'Harvested strat', data: { chain, strat: item, transactionHash, receipt } });
        return {
            transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
            balanceBeforeWei: remainingGasWei,
            // todo: this shouldn't be an estimate
            estimatedProfitWei: item.gasEstimation.estimatedGainWei - item.gasEstimation.transactionCostEstimationWei,
        };
    });

    // ===============
    // final reporting
    // ===============

    // fetching this additional info shouldn't crash the whole harvest
    try {
        await reportOnAsyncCall({ report }, 'collectorBalanceAfter', async () => {
            const [balanceWei, wnativeBalanceWei] = await Promise.all([
                publicClient.getBalance({ address: walletAccount.address }),
                publicClient.readContract({
                    abi: WnativeABI,
                    address: getChainWNativeTokenAddress(chain),
                    functionName: 'balanceOf',
                    args: [walletAccount.address],
                }),
            ]);
            return { balanceWei, wnativeBalanceWei, aggregatedBalanceWei: balanceWei + wnativeBalanceWei };
        });
    } catch (e) {
        logger.error({ msg: 'Error getting collector balance after', data: { chain, e } });
    }

    return report;
}
