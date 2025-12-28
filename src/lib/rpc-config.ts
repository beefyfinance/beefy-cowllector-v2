import type { Hex, HttpTransportConfig, MulticallBatchOptions } from 'viem';

export type RpcConfig = {
    url: string;
    eol: boolean;
    timeoutMs: number;
    batch: {
        // https://viem.sh/docs/clients/transports/http.html#batch-batchsize-optional
        // applies at the transport level
        jsonRpc: HttpTransportConfig['batch'];
        // https://viem.sh/docs/clients/public.html#batch-multicall-batchsize-optional
        // only applies for the public client
        multicall: false | MulticallBatchOptions;
    };
    retry: {
        maxAttempts: number;
        exponentialDelayMs: number; // delay between attempts in ms, multiplied by the attempt number
    };
    transaction: (
        | {
              type: 'legacy';
              maxNativePerTransactionWei: bigint | null;
              maxGasPricePerTransactionWei: bigint | null;
          }
        | {
              type: 'eip1559';
              maxNativePerTransactionWei: bigint | null;
              maxGasPricePerTransactionWei: bigint | null;
          }
    ) & {
        // @see aggressivelyWriteContract
        totalTries: number;
        // @see aggressivelyWriteContract
        forceGasPrice: {
            maxFeePerGas: bigint | null;
            maxPriorityFeePerGas: bigint | null;
            gasPrice: bigint | null;
        };
        retryGasMultiplier: {
            gasPrice: number;
            maxFeePerGas: number;
            maxPriorityFeePerGas: number;
        };
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
        harvestLens: null | { kind: 'v1' | 'v2' | 'v3'; address: Hex };
        deployer: Hex | null;
        revenueBridge: Hex | null;
    };
    account: {
        privateKey: Hex;
    };
    harvest: {
        // some chains are harvested a different way
        enabled: boolean;

        // profitability check is implemented for some chains only
        // it is especially difficult to implement for L2 chains that have various way of dealing with L1 gas
        // for example, zksync has a gas rebate, optimism has additional L1 fees, etc.
        profitabilityCheck: {
            enabled: boolean;
            minExpectedRewardsWei: bigint;
        };

        // time between harvests based on the tvl bucket
        // this is an ordered list, so the first matching bucket will be used
        harvestTimeBuckets: {
            minTvlThresholdUsd: number;
            targetTimeBetweenHarvestsMs: number;
        }[];

        clmHarvestTimeBuckets: {
            minTvlThresholdUsd: number;
            targetTimeBetweenHarvestsMs: number;
        }[];

        // wether we should set the transaction gas limit
        setTransactionGasLimit: boolean;

        // multicall config
        parallelSimulations: number;

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
            minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: number;
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

        // wether we should set the transaction gas limit
        setTransactionGasLimit: boolean;

        // these parameters are used to know if we have enough gas to send a transaction
        balanceCheck: {
            // how much gas we need to have in our wallet to send a transaction
            // on the basis of the current transaction estimated total cost
            // setting this to 2 means that we need to have 2 times the estimated cost in our wallet
            minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: number;
        };
    };
    revenueBridgeHarvest: {
        enabled: boolean;

        // some of the revenue bridge implementations estimateContractGas fail to succeed
        // since this transaction has pretty stable gas cost, we can hardcode it
        forceGasLimit: bigint | null;

        // wether we should set the transaction gas limit
        setTransactionGasLimit: boolean;

        // these parameters are used to know if we have enough gas to send a transaction
        balanceCheck: {
            // how much gas we need to have in our wallet to send a transaction
            // on the basis of the current transaction estimated total cost
            // setting this to 2 means that we need to have 2 times the estimated cost in our wallet
            minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: number;
        };
    };
    alerting: {
        // days to wait before a network congestion requires a decision
        networkCongestionWaitInDays: number;

        // enable or disable the wallet balance too low alert
        // useful for gasless chains like saga
        walletBalanceTooLowAlert: boolean;
    };
};
