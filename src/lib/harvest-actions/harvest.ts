import { Hex } from 'viem';
import { rootLogger } from '../../util/logger';
import { IStrategyABI } from '../../abi/IStrategyABI';
import { NotEnoughRemainingGasError } from '../harvest-errors';
import { Chain } from '../chain';
import { getRpcActionParams } from '../rpc-client';
import { bigintMultiplyFloat } from '../../util/bigint';

const logger = rootLogger.child({ module: 'harvest-actions' });

export type HarvestParameters = {
    strategyAddress: Hex;
    transactionCostEstimationWei: bigint;
    transactionGasLimit: bigint;
};

export type HarvestReturnType = {
    transactionHash: Hex;
    blockNumber: bigint;
    gasUsed: bigint;
    effectiveGasPrice: bigint;
    balanceBeforeWei: bigint;
};

export async function harvest(
    { chain }: { chain: Chain },
    { strategyAddress, transactionCostEstimationWei, transactionGasLimit }: HarvestParameters
): Promise<HarvestReturnType> {
    const { publicClient, walletClient, walletAccount, rpcConfig } = getRpcActionParams({ chain });

    logger.trace({ msg: 'Checking if we have enough gas to harvest', data: { chain, strategyAddress } });
    const balanceBeforeWei = await publicClient.getBalance({ address: walletAccount.address });
    if (
        balanceBeforeWei <
        bigintMultiplyFloat(transactionCostEstimationWei, rpcConfig.harvest.balanceCheck.minWalletThreshold)
    ) {
        logger.info({ msg: 'Not enough gas to harvest', data: { chain, balanceBeforeWei, strategyAddress } });
        const error = new NotEnoughRemainingGasError({
            chain,
            remainingGasWei: balanceBeforeWei,
            transactionCostEstimationWei,
            strategyAddress,
        });
        throw error;
    }
    logger.debug({ msg: 'Enough gas to harvest', data: { chain, balanceBeforeWei, strategyAddress } });

    logger.trace({ msg: 'Harvesting strat', data: { chain, strategyAddress } });
    const { transactionHash, transactionReceipt } = await walletClient.aggressivelyWriteContract({
        abi: IStrategyABI,
        address: strategyAddress,
        functionName: 'harvest',
        args: [walletAccount.address],
        account: walletAccount,
        // setting a gas limit is mandatory since the viem default is too low for larger protocols
        gas: transactionGasLimit,
    });

    logger.info({ msg: 'Harvested strat', data: { chain, strategyAddress, transactionHash, transactionReceipt } });
    return {
        transactionHash,
        blockNumber: transactionReceipt.blockNumber,
        gasUsed: transactionReceipt.gasUsed,
        effectiveGasPrice: transactionReceipt.effectiveGasPrice,
        balanceBeforeWei,
    };
}
