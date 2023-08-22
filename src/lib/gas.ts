import { bigintMultiplyFloat } from '../util/bigint';
import { HARVEST_CACHE_GAS_ESTIMATIONS_SECONDS, HARVEST_GAS_PRICE_MULTIPLIER, RPC_CONFIG } from './config';

import { Hex, PublicClient } from 'viem';
import { getRedisClient } from '../util/redis';
import { IStrategyABI } from '../abi/IStrategyABI';
import { getWalletAccount } from './rpc-client';
import { Chain } from './chain';
import { rootLogger } from '../util/logger';

const logger = rootLogger.child({ module: 'gas' });

export type GasEstimationResult = { from: 'chain' | 'cache'; estimation: bigint };

export type GasEstimationReport = {
    // input values
    rawGasPrice: bigint;
    rawGasAmountEstimation: GasEstimationResult;
    estimatedCallRewardsWei: bigint;
    gasPriceMultiplier: number;
    // computed values
    gasPrice: bigint;
    transactionCostEstimationWei: bigint;
    estimatedGainWei: bigint;
    wouldBeProfitable: boolean;
};

export function createGasEstimationReport({
    rawGasPrice,
    estimatedCallRewardsWei,
    rawGasAmountEstimation,
    gasPriceMultiplier = HARVEST_GAS_PRICE_MULTIPLIER,
}: {
    // current network gas price in wei
    rawGasPrice: bigint; // in wei
    // estimation of the gas amount required for the transaction
    rawGasAmountEstimation: GasEstimationResult; // in gas units
    // estimation of the call rewards in wei
    estimatedCallRewardsWei: bigint; // in wei
    // multiply the gas price by some value to overestimate the gas cost
    gasPriceMultiplier?: number;
}): GasEstimationReport {
    const gasPrice = bigintMultiplyFloat(rawGasPrice, gasPriceMultiplier);
    const transactionCostEstimationWei = rawGasAmountEstimation.estimation * gasPrice;
    const estimatedGainWei = estimatedCallRewardsWei - transactionCostEstimationWei;
    const wouldBeProfitable = estimatedGainWei > 0;
    return {
        rawGasPrice,
        rawGasAmountEstimation,
        estimatedCallRewardsWei,
        gasPriceMultiplier,
        gasPrice,
        transactionCostEstimationWei,
        estimatedGainWei,
        wouldBeProfitable,
    };
}

/**
 * Estimate a contract call gas cost by simulating the call.
 *
 * We can't use multicall: https://github.com/mds1/multicall/issues/39#issuecomment-1235732815
 * So we must use eth_estimateGas but we take advantage of the fact that the underlying harvest
 * of strategies is somewhat predictable so we can cache the results of the simulation
 */
export async function estimateHarvestCallGasAmount({
    chain,
    rpcClient,
    strategyAddress,
}: {
    chain: Chain;
    rpcClient: PublicClient;
    strategyAddress: Hex;
}): Promise<GasEstimationResult> {
    const redisClient = await getRedisClient();
    const walletAccount = getWalletAccount({ chain });

    const cacheKey = `gas-estimation:harvest:${strategyAddress.toLocaleLowerCase()}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        logger.trace({ msg: 'Using cached gas estimation', data: { strategyAddress, cached } });
        return { from: 'cache', estimation: BigInt(cached) };
    }

    logger.trace({ msg: 'Estimating gas cost', data: { strategyAddress } });

    const gasParams = RPC_CONFIG[chain].gasConfig?.estimateContractGas ?? {};
    const estimation = await rpcClient.estimateContractGas({
        // we use the lens to avoid having bad estimations on error
        abi: IStrategyABI,
        address: strategyAddress,
        functionName: 'harvest',
        args: [walletAccount.address],
        account: walletAccount,
        ...gasParams,
    });

    logger.trace({ msg: 'Gas estimation from chain done', data: { strategyAddress, estimation } });

    await redisClient.set(cacheKey, estimation.toString(), { EX: HARVEST_CACHE_GAS_ESTIMATIONS_SECONDS });

    return { from: 'chain', estimation };
}
