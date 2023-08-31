import { Hex } from 'viem';
import { Chain } from './chain';
import { Async, TimingData } from '../util/async';
import { AItem, AKey, AVal, reportOnSingleAsyncCall } from './reports';
import { CollectorBalance } from './collector-balance';

type UnwrapReportShouldUnwrapDecision =
    | {
          shouldUnwrap: false;
          triggerAmount: bigint;
          actualAmount: bigint;
          notUnwrappingReason: 'too few wnative to unwrap';
      }
    | {
          shouldUnwrap: true;
          triggerAmount: bigint;
          actualAmount: bigint;
      };

export type UnwrapReport = {
    timing: TimingData | null;
    chain: Chain;
    collectorBalanceBefore: Async<CollectorBalance> | null;
    collectorBalanceAfter: Async<CollectorBalance> | null;
    unwrapDecision: Async<UnwrapReportShouldUnwrapDecision> | null;
    unwrapTransaction: Async<{
        transactionHash: Hex;
        blockNumber: bigint;
        gasUsed: bigint;
        effectiveGasPrice: bigint;
        balanceBeforeWei: bigint;
        unwrappedAmount: bigint;
        rawGasEstimation: bigint;
        gasLimit: bigint;
    }> | null;
    summary: {
        success: boolean;
        unwrapped: boolean;
        nativeGasUsedWei: bigint;
        wnativeProfitWei: bigint;
        aggregatedProfitWei: bigint;
    };
};

export function createDefaultUnwrapReport({ chain }: { chain: Chain }): UnwrapReport {
    return {
        timing: null,
        chain,
        collectorBalanceBefore: null,
        collectorBalanceAfter: null,
        unwrapDecision: null,
        unwrapTransaction: null,
        summary: {
            success: false,
            unwrapped: false,
            nativeGasUsedWei: 0n,
            wnativeProfitWei: 0n,
            aggregatedProfitWei: 0n,
        },
    };
}

// re-export the helper functions with preset types
export function reportOnSingleUnwrapAsyncCall<
    TKey extends AKey<UnwrapReport>,
    TItem extends AItem<UnwrapReport>,
    TVal extends AVal<UnwrapReport, TKey>,
>(...args: Parameters<typeof reportOnSingleAsyncCall<UnwrapReport, TKey, TItem, TVal>>) {
    return reportOnSingleAsyncCall<UnwrapReport, TKey, TItem, TVal>(...args);
}
