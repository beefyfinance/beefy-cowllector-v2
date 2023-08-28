import { type Chain as ViemChain, type WaitForTransactionReceiptReturnType, BlockNotFoundError, Hex } from 'viem';
import { rootLogger } from '../../util/logger';
import { withRetry } from '../../util/promise';
import { RpcActionParams } from '../rpc-client';

export type AggressivelyWaitForTransactionReceiptParameters = {
    hash: Hex;
};

export type AggressivelyWaitForTransactionReceiptReturnType<TChain extends ViemChain | undefined> =
    WaitForTransactionReceiptReturnType<TChain>;

const logger = rootLogger.child({ module: 'rpc-actions', component: 'aggressivelyWaitForTransactionReceipt' });

export function aggressivelyWaitForTransactionReceipt<TChain extends ViemChain | undefined>(
    { publicClient, rpcConfig }: RpcActionParams,
    args: AggressivelyWaitForTransactionReceiptParameters
): Promise<WaitForTransactionReceiptReturnType<TChain>> {
    return withRetry(
        () =>
            publicClient.waitForTransactionReceipt({
                hash: args.hash,
                confirmations: rpcConfig.transaction.blockConfirmations,
                timeout: rpcConfig.transaction.timeoutMs,
                pollingInterval: rpcConfig.transaction.pollingIntervalMs,
            }) as Promise<WaitForTransactionReceiptReturnType<TChain>>,
        {
            // do not retry too much since waitForTransactionReceipt is already retrying a bunch
            retryCount: 5,
            delay: 1000,
            shouldRetry: err => {
                // we want to retry on BlockNotFoundError
                // this happens when we use an rpc cluster with many nodes and we hit one that is lagging behind
                // happens a lot with ankr's rpc cluster
                if (err instanceof BlockNotFoundError) {
                    logger.warn({ msg: 'waitForTransactionReceipt: block not found, retrying', data: { err } });
                    return true;
                }

                return false;
            },
        }
    );
}
