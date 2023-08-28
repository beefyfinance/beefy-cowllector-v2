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
        retries: number;
        retryGasMultiplier: number;
        blockConfirmations: number;
        timeoutMs: number;
        pollingIntervalMs?: number;
    };
    contracts: {
        harvestLens: Hex | null;
        deployer: Hex | null;
    };
    account: {
        privateKey: Hex;
    };
    // allow overriding the gas price for a gas estimation
    gasConfig?: {
        estimateContractGas?:
            | {
                  // EIP-1559
                  maxPriorityFeePerGas: bigint;
                  maxFeePerGas?: bigint; // will be detected by viem if not provided
              }
            | {
                  // legacy
                  gasPrice: bigint;
              };
    };
    unwrap: {
        triggerAmountWei: bigint;
    };
};
