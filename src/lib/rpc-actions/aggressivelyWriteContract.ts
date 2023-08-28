import {
    type Chain as ViemChain,
    type SimulateContractReturnType,
    type Abi,
    type SimulateContractParameters,
    Hex,
    TimeoutError,
    BlockNotFoundError,
    TransactionReceipt,
} from 'viem';
import { type AggressivelyWaitForTransactionReceiptReturnType } from './aggressivelyWaitForTransactionReceipt';
import { rootLogger } from '../../util/logger';
import { getRpcActionParams } from '../rpc-client';
import { Chain } from '../chain';
import { bigintMultiplyFloat } from '../../util/bigint';

export type AggressivelyWriteContractParameters<
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends string,
    TChain extends ViemChain | undefined,
    TChainOverride extends ViemChain | undefined,
> = SimulateContractParameters<TAbi, TFunctionName, TChain, TChainOverride>;

// we return the simulation result and the transaction receipt and hash
export type AggressivelyWriteContractReturnType<
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends string,
    TChain extends ViemChain | undefined,
    TChainOverride extends ViemChain | undefined,
> = {
    simulation: SimulateContractReturnType<TAbi, TFunctionName, TChain, TChainOverride>['result'];
    transactionHash: Hex;
    transactionReceipt: AggressivelyWaitForTransactionReceiptReturnType<TChain>;
};

const logger = rootLogger.child({ module: 'rpc-actions', component: 'aggressivelyWriteContract' });

/**
 * How this method works:
 * - send a transaction Tx1 with nonce N and gasPrice Gp1
 * - await for Tx1 to be minted for T time.
 * - After T, if Tx1 was not minted, submit Tx2 with nonce N (same) and price = Gp2, where Gp2 = Gp1 * mult (mult > 1)
 * - await for Tx1 or Tx2 to be minted for T time.
 * - After T, if nothing was not minted, submit Tx2 with nonce N (same) and price = Gp3, where Gp3 = Gp2 * mult
 * - await for Tx1, Tx2 or Tx3 to be minted for T time.
 * ... repeat R times until something go through or we hit the max number of retries.
 */
export async function aggressivelyWriteContract<
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends string,
    TChain extends ViemChain | undefined,
    TChainOverride extends ViemChain | undefined,
>(
    { chain }: { chain: Chain },
    args: AggressivelyWriteContractParameters<TAbi, TFunctionName, TChain, TChainOverride>
): Promise<AggressivelyWriteContractReturnType<TAbi, TFunctionName, TChain, TChainOverride>> {
    const { publicClient, walletClient, walletAccount, rpcConfig } = getRpcActionParams({ chain });
    const nonce = await publicClient.getTransactionCount({
        address: walletAccount.address,
        blockTag: 'pending',
    });
    logger.debug({ msg: 'Got nonce', data: { chain, address: args.address, nonce } });

    const gasParams = await publicClient.estimateFeesPerGas({
        type: rpcConfig.transaction.type,
    });
    logger.debug({ msg: 'Got gas params', data: { chain, address: args.address, gasParams } });

    const allPendingTransactions: Hex[] = [];

    const mint = async () => {
        const { request, result: simulationResult } = await publicClient.simulateContract({
            ...(args as any), // TODO: fix typings
            ...gasParams,
            nonce,
        });
        logger.trace({ msg: 'Simulation ok', data: { chain, address: args.address, request } });
        const transactionHash = await walletClient.writeContract(request as any); // TODO: fix typings
        logger.debug({ msg: 'Harvested strat', data: { chain, transactionHash } });
        allPendingTransactions.push(transactionHash);
        // wait for the transaction to be mined so we have a proper nonce for the next transaction
        logger.trace({
            msg: 'Waiting for transaction receipts',
            data: { chain, address: args.address, allPendingTransactions },
        });

        let receipt: TransactionReceipt;
        try {
            receipt = await Promise.any(
                allPendingTransactions.map(hash => publicClient.waitForTransactionReceipt({ hash }))
            );
        } catch (err) {
            if (err instanceof AggregateError) {
                throw err.errors[err.errors.length - 1];
            }
            throw err;
        }
        logger.debug({
            msg: 'Got transaction receipt',
            data: { chain, address: args.address, transactionHash, receipt },
        });

        return {
            simulation: simulationResult as any, // TODO: fix typings
            transactionHash: receipt.transactionHash,
            transactionReceipt: receipt as any, // TODO: fix typings
        };
    };

    for (let i = 0; i < rpcConfig.transaction.retries; i++) {
        try {
            logger.trace({ msg: 'Trying to mint', data: { chain, address: args.address, try: i, gasParams } });
            return await mint();
        } catch (err) {
            if (
                (err instanceof TimeoutError || err instanceof BlockNotFoundError) &&
                i < rpcConfig.transaction.retries - 1
            ) {
                logger.warn({ msg: 'Simulation timed out', data: { chain, address: args.address } });
                // increase the gas price for the next transaction
                if (gasParams.gasPrice) {
                    gasParams.gasPrice = bigintMultiplyFloat(
                        gasParams.gasPrice,
                        rpcConfig.transaction.retryGasMultiplier
                    );
                }
                if (gasParams.maxPriorityFeePerGas) {
                    gasParams.maxPriorityFeePerGas = bigintMultiplyFloat(
                        gasParams.maxPriorityFeePerGas,
                        rpcConfig.transaction.retryGasMultiplier
                    );
                }
            } else {
                logger.warn({ msg: 'Simulation failed', data: { chain, address: args.address, err } });
                throw err;
            }
        }
    }
    throw new Error('Should not happen');
}
