import type { Hex, MulticallBatchOptions } from 'viem';
import type { BatchOptions } from 'viem/dist/types/clients/transports/http';

export type RpcConfig = {
    url: string;
    eol: boolean;
    timeoutMs: number;
    batch: {
        // https://viem.sh/docs/clients/transports/http.html#batch-batchsize-optional
        // applies at the transport level
        jsonRpc: false | BatchOptions;
        // https://viem.sh/docs/clients/public.html#batch-multicall-batchsize-optional
        // only applies for the public client
        multicall: false | MulticallBatchOptions;
    };
    transaction: {
        type: 'legacy' | 'eip1559';
        // @see aggressivelyWriteContract
        totalTries: number;
        retryGasMultiplier: number;
        // default gas price multiplier, effective on the first try
        baseFeeMultiplier: number;
        receipt: {
            // how many blocks to wait for the transaction to be considered mined
            blockConfirmations: number;
            // if we detect a transaction not found, retry this many times
            // this is useful when using an rpc cluster with many nodes and we hit one that is lagging behind
            notFoundErrorRetryCount: number;
            notFoundErrorRetryDelayMs: number;
            // this timeout is used for each wait call
            receiptTimeoutMs: number;
            // poll for the receipt every X ms
            pollingIntervalMs?: number;
        };
    };
    contracts: {
        harvestLens: Hex | null;
        deployer: Hex | null;
    };
    account: {
        privateKey: Hex;
    };
    unwrap: {
        triggerAmountWei: bigint;
    };
    tvl: {
        minThresholdUsd: number;
    };
};
