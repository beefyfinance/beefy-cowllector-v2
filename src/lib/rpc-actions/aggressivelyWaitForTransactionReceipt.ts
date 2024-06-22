import {
    BlockNotFoundError,
    type Hex,
    TimeoutError,
    TransactionReceiptNotFoundError,
    type Chain as ViemChain,
    type WaitForTransactionReceiptReturnType,
} from 'viem';
import { rootLogger } from '../../util/logger';
import { withRetry } from '../../util/promise';
import type { Chain } from '../chain';
import { getRpcActionParams } from '../rpc-client';

export type AggressivelyWaitForTransactionReceiptParameters = {
    hash: Hex;
};

export type AggressivelyWaitForTransactionReceiptReturnType<TChain extends ViemChain | undefined> =
    WaitForTransactionReceiptReturnType<TChain>;

const logger = rootLogger.child({
    module: 'rpc-actions',
    component: 'aggressivelyWaitForTransactionReceipt',
});

// BlockNotFoundError: when we use an rpc cluster with many nodes and we hit one that is lagging behind, happens a lot with ankr's rpc cluster
// TransactionReceiptNotFoundError: when a transaction is not mined yet and we are waiting for it
// TimeoutError: when we are waiting for a transaction receipt and we hit the RPC timeout
const retryableErrorsWhileWaitingForReceipt = [TimeoutError, BlockNotFoundError, TransactionReceiptNotFoundError];

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
                for (const retryableError of retryableErrorsWhileWaitingForReceipt) {
                    if (err instanceof retryableError) {
                        logger.warn({
                            msg: 'found a retryable error, retrying',
                            data: { err },
                        });
                        return true;
                    }
                }
                return false;
            },
        }
    );
}
