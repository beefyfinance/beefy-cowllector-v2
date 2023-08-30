import {
    type Chain as ViemChain,
    type WaitForTransactionReceiptReturnType,
    BlockNotFoundError,
    Hex,
    TransactionReceiptNotFoundError,
} from 'viem';
import { rootLogger } from '../../util/logger';
import { withRetry } from '../../util/promise';
import { getRpcActionParams } from '../rpc-client';
import { Chain } from '../chain';

export type AggressivelyWaitForTransactionReceiptParameters = {
    hash: Hex;
};

export type AggressivelyWaitForTransactionReceiptReturnType<TChain extends ViemChain | undefined> =
    WaitForTransactionReceiptReturnType<TChain>;

const logger = rootLogger.child({ module: 'rpc-actions', component: 'aggressivelyWaitForTransactionReceipt' });

export function aggressivelyWaitForTransactionReceipt<TChain extends ViemChain | undefined>(
    { chain }: { chain: Chain },
    args: AggressivelyWaitForTransactionReceiptParameters
): Promise<WaitForTransactionReceiptReturnType<TChain>> {
    const { publicClient, rpcConfig } = getRpcActionParams({ chain });
    return withRetry(
        () =>
            publicClient.waitForTransactionReceipt({
                hash: args.hash,
                confirmations: rpcConfig.transaction.receipt.blockConfirmations,
                timeout: rpcConfig.transaction.receipt.receiptTimeoutMs,
                pollingInterval: rpcConfig.transaction.receipt.pollingIntervalMs,
            }) as Promise<WaitForTransactionReceiptReturnType<TChain>>,
        {
            // do not retry too much since waitForTransactionReceipt is already retrying a bunch
            retryCount: rpcConfig.transaction.receipt.notFoundErrorRetryCount,
            delay: rpcConfig.transaction.receipt.notFoundErrorRetryDelayMs,
            shouldRetry: err => {
                // we want to retry on BlockNotFoundError
                // this happens when we use an rpc cluster with many nodes and we hit one that is lagging behind
                // happens a lot with ankr's rpc cluster
                if (err instanceof BlockNotFoundError) {
                    logger.warn({ msg: 'waitForTransactionReceipt: block not found, retrying', data: { err } });
                    return true;
                } else if (err instanceof TransactionReceiptNotFoundError) {
                    logger.warn({
                        msg: 'waitForTransactionReceipt: transaction receipt not found, retrying',
                        data: { err },
                    });
                    return true;
                }

                return false;
            },
        }
    );
}
