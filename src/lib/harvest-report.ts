import { GasEstimationReport } from './gas';
import { BeefyVault } from './vault';
import { Hex } from 'viem';
import { Chain } from './chain';
import { Async, TimingData } from '../util/async';
import { AItem, AKey, AVal, reportOnMultipleAsyncCall, reportOnSingleAsyncCall } from './reports';
import { CollectorBalance } from './collector-balance';

export type HarvestReport = {
    timing: TimingData | null;
    chain: Chain;
    details: HarvestReportItem[];
    fetchGasPrice: Async<{ gasPriceWei: bigint }> | null;
    collectorBalanceBefore: Async<CollectorBalance> | null;
    collectorBalanceAfter: Async<CollectorBalance> | null;
    summary: {
        nativeGasUsedWei: bigint;
        wnativeProfitWei: bigint;
        aggregatedProfitWei: bigint;
        totalStrategies: number;
        harvested: number;
        skipped: number;
        errors: number;
        warnings: number;
    };
};

type HarvestReportSimulation = Async<{
    estimatedCallRewardsWei: bigint;
    harvestWillSucceed: boolean;
    lastHarvest: Date;
    hoursSinceLastHarvest: number;
    isLastHarvestRecent: boolean;
    paused: boolean;
}>;

type HarvestReportGasEstimation = Async<GasEstimationReport>;

// warn: true will tell the notifier to send a message
type HarvestReportIsLiveDecision =
    | {
          shouldHarvest: false;
          warning: true;
          notHarvestingReason: 'harvest would fail';
      }
    | {
          shouldHarvest: false;
          hoursSinceLastHarvest: number;
          warning: true;
          notHarvestingReason: 'estimated call rewards is 0 and vault has not been harvested in a long time';
      }
    | {
          shouldHarvest: false;
          warning: false;
          hoursSinceLastHarvest: number;
          notHarvestingReason: 'estimated call rewards is 0';
      }
    | {
          shouldHarvest: false;
          warning: false;
          notHarvestingReason: 'strategy paused';
      }
    | {
          shouldHarvest: false;
          warning: false;
          notHarvestingReason: 'vault is eol';
      }
    | {
          shouldHarvest: true;
          warning: false;
      };

type HarvestReportShouldHarvestDecision =
    | {
          shouldHarvest: false;
          callRewardsWei: bigint;
          hoursSinceLastHarvest: number;
          estimatedGainWei: bigint;
          wouldBeProfitable: boolean;
          notHarvestingReason: 'not profitable and harvested too recently';
      }
    | {
          shouldHarvest: true;
          callRewardsWei: bigint;
          hoursSinceLastHarvest: number;
          estimatedGainWei: bigint;
          wouldBeProfitable: boolean;
      };

type HarvestReportHarvestTransaction = Async<{
    transactionHash: Hex;
    blockNumber: bigint;
    gasUsed: bigint;
    effectiveGasPrice: bigint;
    balanceBeforeWei: bigint;
    estimatedProfitWei: bigint;
}>;

type HarvestReportItem = {
    // context data
    vault: BeefyVault;

    // harvest steps, null: not started
    simulation: HarvestReportSimulation | null;
    isLiveDecision: HarvestReportIsLiveDecision | null;
    gasEstimation: HarvestReportGasEstimation | null;
    harvestDecision: HarvestReportShouldHarvestDecision | null;
    harvestTransaction: HarvestReportHarvestTransaction | null;

    // summary
    summary: {
        harvested: boolean;
        error: boolean;
        warning: boolean;
        estimatedProfitWei: bigint;
    };
};

export function createDefaultHarvestReport({ chain }: { chain: Chain }): HarvestReport {
    return {
        timing: null,
        chain,
        details: [],
        fetchGasPrice: null,
        collectorBalanceBefore: null,
        collectorBalanceAfter: null,
        summary: {
            nativeGasUsedWei: 0n,
            wnativeProfitWei: 0n,
            aggregatedProfitWei: 0n,
            totalStrategies: 0,
            harvested: 0,
            skipped: 0,
            errors: 0,
            warnings: 0,
        },
    };
}

export function createDefaultHarvestReportItem({ vault }: { vault: BeefyVault }): HarvestReportItem {
    return {
        vault,

        simulation: null,
        gasEstimation: null,
        isLiveDecision: null,
        harvestDecision: null,
        harvestTransaction: null,

        summary: {
            harvested: false,
            error: false,
            warning: false,
            estimatedProfitWei: 0n,
        },
    };
}

// re-export the helper functions with preset types
export function reportOnSingleHarvestAsyncCall<
    TKey extends AKey<HarvestReport>,
    TItem extends AItem<HarvestReport>,
    TVal extends AVal<HarvestReport, TKey>,
>(...args: Parameters<typeof reportOnSingleAsyncCall<HarvestReport, TKey, TItem, TVal>>) {
    return reportOnSingleAsyncCall<HarvestReport, TKey, TItem, TVal>(...args);
}
export function reportOnMultipleHarvestAsyncCall<
    TKey extends AKey<HarvestReportItem>,
    TItem extends AItem<HarvestReportItem>,
    TVal extends AVal<HarvestReportItem, TKey>,
>(...args: Parameters<typeof reportOnMultipleAsyncCall<HarvestReportItem, TKey, TItem, TVal>>) {
    return reportOnMultipleAsyncCall<HarvestReportItem, TKey, TItem, TVal>(...args);
}
