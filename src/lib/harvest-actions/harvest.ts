import { Hex } from 'viem';
import { rootLogger } from '../../util/logger';
import { IStrategyABI } from '../../abi/IStrategyABI';
import { RpcActionParams } from '../rpc-client';
import { NotEnoughRemainingGasError } from '../harvest-errors';

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
    { publicClient, walletClient, walletAccount, rpcConfig, chain }: RpcActionParams,
    { strategyAddress, transactionCostEstimationWei, transactionGasLimit }: HarvestParameters
): Promise<HarvestReturnType> {
    // check if we have enough gas to harvest
    logger.trace({ msg: 'Checking gas', data: { chain, strategyAddress } });
    const balanceBeforeWei = await publicClient.getBalance({ address: walletAccount.address });
    if (balanceBeforeWei < transactionCostEstimationWei) {
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

    // harvest the strat
    // no need to set gas fees as viem has automatic EIP-1559 detection and gas settings
    // https://github.com/wagmi-dev/viem/blob/viem%401.6.0/src/utils/transaction/prepareRequest.ts#L89
    logger.trace({ msg: 'Harvesting strat', data: { chain, strategyAddress } });

    // re-simulate the transaction in case something changed since we estimated the gas
    const { request } = await publicClient.simulateContract({
        abi: IStrategyABI,
        address: strategyAddress,
        functionName: 'harvest',
        args: [walletAccount.address],
        account: walletAccount,
        // setting a gas limit is mandatory since the viem default is too low for larger protocols
        gas: transactionGasLimit,
    });
    logger.trace({ msg: 'Harvest re-simulation ok', data: { chain, strategyAddress, request } });
    const transactionHash = await walletClient.writeContract(request);
    logger.debug({ msg: 'Harvested strat', data: { chain, transactionHash } });

    // wait for the transaction to be mined so we have a proper nonce for the next transaction
    logger.trace({ msg: 'Waiting for transaction receipt', data: { chain, strategyAddress, transactionHash } });
    const receipt = await publicClient.aggressivelyWaitForTransactionReceipt({
        hash: transactionHash,
    });
    logger.debug({ msg: 'Got transaction receipt', data: { chain, strategyAddress, transactionHash, receipt } });

    // now we officially harvested the strat
    logger.info({ msg: 'Harvested strat', data: { chain, strategyAddress, transactionHash, receipt } });
    return {
        transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        balanceBeforeWei,
    };
}
