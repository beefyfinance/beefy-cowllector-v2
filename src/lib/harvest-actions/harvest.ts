import { Hex, TransactionReceipt } from 'viem';
import { rootLogger } from '../../util/logger';
import { IStrategyABI } from '../../abi/IStrategyABI';
import { NotEnoughRemainingGasError } from '../harvest-errors';
import { Chain } from '../chain';
import { getRpcActionParams } from '../rpc-client';
import { bigintMultiplyFloat } from '../../util/bigint';

const logger = rootLogger.child({ module: 'harvest-actions' });

export type HarvestParameters =
    | {
          strategyAddress: Hex;
          transactionCostEstimationWei: bigint;
          transactionGasLimit: bigint;
      }
    | {
          strategyAddress: Hex;
          transactionCostEstimationWei: bigint | null;
          transactionGasLimit: null;
      };

export type HarvestReturnType = {
    transactionHash: Hex;
    blockNumber: bigint;
    gasUsed: bigint;
    effectiveGasPrice: bigint;
    transactionCostWei: bigint;
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
        transactionCostEstimationWei !== null &&
        balanceBeforeWei <
            bigintMultiplyFloat(
                transactionCostEstimationWei,
                rpcConfig.harvest.balanceCheck.minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost
            )
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

    let transactionHash: Hex;
    let transactionReceipt: TransactionReceipt;

    // this happens when we blindly harvest a vault, then we don't know the gas limit
    if (transactionGasLimit === null) {
        transactionHash = await walletClient.writeContract({
            abi: IStrategyABI,
            address: strategyAddress,
            functionName: 'harvest',
            args: [walletAccount.address],
            account: walletAccount,
        });
        transactionReceipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
    } else {
        const res = await walletClient.aggressivelyWriteContract({
            abi: IStrategyABI,
            address: strategyAddress,
            functionName: 'harvest',
            args: [walletAccount.address],
            account: walletAccount,
            // setting a gas limit is mandatory since the viem default is too low for larger protocols
            // but some vaults need to be blindly harvested without knowing the gas limit
            gas: transactionGasLimit,
        });
        transactionHash = res.transactionHash;
        transactionReceipt = res.transactionReceipt;
    }

    logger.info({ msg: 'Harvested strat', data: { chain, strategyAddress, transactionHash, transactionReceipt } });

    let transactionCostWei: bigint;
    if (transactionReceipt.gasUsed && transactionReceipt.effectiveGasPrice) {
        transactionCostWei = BigInt(transactionReceipt.gasUsed) * BigInt(transactionReceipt.effectiveGasPrice);
    } else if (transactionCostEstimationWei !== null) {
        transactionCostWei = transactionCostEstimationWei;
    } else {
        transactionCostWei = BigInt(0);
    }
    return {
        transactionHash,
        blockNumber: transactionReceipt.blockNumber,
        gasUsed: transactionReceipt.gasUsed,
        effectiveGasPrice: transactionReceipt.effectiveGasPrice,
        transactionCostWei: transactionCostWei,
        balanceBeforeWei,
    };
}
