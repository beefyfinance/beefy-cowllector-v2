import { Hex } from 'viem';
import { Chain } from './chain';
import { Async, TimingData } from '../util/async';
import { AItem, AKey, AVal, reportOnSingleAsyncCall } from './reports';
import { CollectorBalance } from './collector-balance';

export type RevenueBridgeHarvestReport = {
    timing: TimingData | null;
    chain: Chain;
    collectorBalanceBefore: Async<CollectorBalance> | null;
    collectorBalanceAfter: Async<CollectorBalance> | null;
    harvestTransaction: Async<{
        transactionHash: Hex;
        blockNumber: bigint;
        gasUsed: bigint;
        effectiveGasPrice: bigint;
        balanceBeforeWei: bigint;
        rawGasEstimation: bigint;
        gasLimit: bigint;
    }> | null;
    summary: {
        success: boolean;
        revenueBridgeHarvested: boolean;
        nativeGasUsedWei: bigint;
        wnativeProfitWei: bigint;
        aggregatedProfitWei: bigint;
    };
};

export function createDefaultRevenueBridgeHarvestReport({ chain }: { chain: Chain }): RevenueBridgeHarvestReport {
    return {
        timing: null,
        chain,
        collectorBalanceBefore: null,
        collectorBalanceAfter: null,
        harvestTransaction: null,
        summary: {
            success: false,
            revenueBridgeHarvested: false,
            nativeGasUsedWei: 0n,
            wnativeProfitWei: 0n,
            aggregatedProfitWei: 0n,
        },
    };
}

// re-export the helper functions with preset types
export function reportOnSingleRevenueBridgeHarvestAsyncCall<
    TKey extends AKey<RevenueBridgeHarvestReport>,
    TItem extends AItem<RevenueBridgeHarvestReport>,
    TVal extends AVal<RevenueBridgeHarvestReport, TKey>,
>(...args: Parameters<typeof reportOnSingleAsyncCall<RevenueBridgeHarvestReport, TKey, TItem, TVal>>) {
    return reportOnSingleAsyncCall<RevenueBridgeHarvestReport, TKey, TItem, TVal>(...args);
}
