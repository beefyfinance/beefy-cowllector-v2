import { HARVEST_CACHE_GAS_ESTIMATIONS_SECONDS, RPC_CONFIG } from '../config';
import { Hex } from 'viem';
import { getRedisClient } from '../../util/redis';
import { IStrategyABI } from '../../abi/IStrategyABI';
import { rootLogger } from '../../util/logger';
import { GasEstimationResult } from '../gas';
import { Chain } from '../chain';
import { getRpcActionParams } from '../rpc-client';

const logger = rootLogger.child({ module: 'harvest-actions', component: 'estimateHarvestCallGasAmount' });

/**
 * Estimate a contract call gas cost by simulating the call.
 *
 * We can't use multicall: https://github.com/mds1/multicall/issues/39#issuecomment-1235732815
 * So we must use eth_estimateGas but we take advantage of the fact that the underlying harvest
 * of strategies is somewhat predictable so we can cache the results of the simulation
 */
export async function estimateHarvestCallGasAmount(
    { chain }: { chain: Chain },
    {
        strategyAddress,
    }: {
        strategyAddress: Hex;
    }
): Promise<GasEstimationResult> {
    const { publicClient, walletAccount } = getRpcActionParams({ chain });

    const redisClient = await getRedisClient();

    const cacheKey = `gas-estimation:harvest:${strategyAddress.toLocaleLowerCase()}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        logger.trace({ msg: 'Using cached gas estimation', data: { strategyAddress, cached } });
        return { from: 'cache', estimation: BigInt(cached) };
    }

    logger.trace({ msg: 'Estimating gas cost', data: { strategyAddress } });

    const gasParams = RPC_CONFIG[chain].gasConfig?.estimateContractGas ?? {};
    const estimation = await publicClient.estimateContractGas({
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
