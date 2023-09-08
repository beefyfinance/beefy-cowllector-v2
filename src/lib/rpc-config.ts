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
    transaction: (
        | {
              type: 'legacy';
              maxNativePerTransactionWei: bigint | null;
              maxGasPricePerTransactionWei: bigint | null;
          }
        | {
              type: 'eip1559';
          }
    ) & {
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
    harvest: {
        // some chains are harvested a different way
        enabled: boolean;

        // we try to harvest at most every X ms (24h by default)
        targetTimeBetweenHarvestsMs: number;

        // We only harvest if the vault tvl is above this threshold
        minTvlThresholdUsd: number;

        // these parameters are used to know if we have enough gas to send a transaction
        balanceCheck: {
            // by how much we should multiply our given gas price
            // we need to set this high enough to be sure that any fluctuation in the gas price
            // will not make us send a transaction bound to fail
            gasPriceMultiplier: number;
            // how much gas to add to the estimation, in percentage
            gasLimitMultiplier: number;
            // how much gas we need to have in our wallet to send a transaction
            // on the basis of the current transaction estimated total cost
            // setting this to 2 means that we need to have 2 times the estimated cost in our wallet
            minWalletThreshold: number;
        };
    };
    unwrap: {
        // some chains do not need unwrapping
        // as their native token is also an erc20 contract (mostly metis and celo)
        enabled: boolean;

        // we try to unwrap if the amount of wrapped tokens is above this threshold
        minAmountOfWNativeWei: bigint;
        // but only if we are low on native
        maxAmountOfNativeWei: bigint;

        // these parameters are used to know if we have enough gas to send a transaction
        balanceCheck: {
            // how much gas we need to have in our wallet to send a transaction
            // on the basis of the current transaction estimated total cost
            // setting this to 2 means that we need to have 2 times the estimated cost in our wallet
            minWalletThreshold: number;
        };
    };
};
