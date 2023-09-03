import { GasEstimationReport } from './gas';
import { BeefyVault } from './vault';
import { Hex } from 'viem';
import { Chain } from './chain';
import { Async, TimingData } from '../util/async';
import { AItem, AKey, AVal, reportOnMultipleAsyncCall, reportOnSingleAsyncCall } from './reports';
import { CollectorBalance } from './collector-balance';
import { ReportAsyncStatus } from './report-error-status';

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
        statuses: {
            [status in ReportAsyncStatus]: number;
        };
    };
};

type HarvestReportSimulation = Async<{
    estimatedCallRewardsWei: bigint;
    gas: GasEstimationReport;
    harvestWillSucceed: boolean;
    lastHarvest: Date;
    hoursSinceLastHarvest: number;
    isLastHarvestRecent: boolean;
    paused: boolean;
    blockNumber: bigint;
    harvestResultData: Hex;
}>;

export type HarvestReportDecision = Async<
    | {
          shouldHarvest: false;
          level: 'info';
          tvlThresholdUsd: number;
          vaultTvlUsd: number;
          notHarvestingReason: 'Tvl do not meet minimum threshold';
      }
    | {
          shouldHarvest: false;
          level: 'info';
          notHarvestingReason: 'vault not compatible with lens: missing `harvest(address recipient)` function';
      }
    | {
          shouldHarvest: false;
          level: 'info';
          notHarvestingReason: 'harvest would fail but it is a gamma vault so it might just be out of range';
      }
    | {
          shouldHarvest: false;
          level: 'notice';
          harvestReturnData: Hex;
          blockNumber: bigint;
          notHarvestingReason: 'Vault has a bug that makes it fail to harvest?';
      }
    | {
          shouldHarvest: false;
          level: 'error';
          notHarvestingReason: 'harvest would fail';
          harvestReturnData: Hex;
          blockNumber: bigint;
      }
    | {
          shouldHarvest: false;
          level: 'info';
          notHarvestingReason: 'vault is eol';
      }
    | {
          shouldHarvest: false;
          level: 'info';
          notHarvestingReason: 'strategy paused';
      }
    | {
          shouldHarvest: false;
          level: 'info';
          hoursSinceLastHarvest: number;
          notHarvestingReason: 'estimated call rewards is 0, but vault harvested recently';
      }
    | {
          shouldHarvest: false;
          hoursSinceLastHarvest: number;
          level: 'info';
          notHarvestingReason: 'estimated call rewards is 0, but this is ok for this vault';
      }
    | {
          shouldHarvest: false;
          level: 'notice';
          hoursSinceLastHarvest: number;
          notHarvestingReason: 'estimated call rewards is 0, but this vault is notoriously slow to refill rewards';
      }
    | {
          shouldHarvest: false;
          hoursSinceLastHarvest: number;
          level: 'warning';
          notHarvestingReason: 'estimated call rewards is 0 and vault has not been harvested in a long time';
      }
    | {
          shouldHarvest: false;
          level: 'info';
          callRewardsWei: bigint;
          hoursSinceLastHarvest: number;
          estimatedGainWei: bigint;
          wouldBeProfitable: boolean;
          notHarvestingReason: 'harvested too recently';
      }
    | {
          shouldHarvest: true;
          level: 'info';
          callRewardsWei: bigint;
          hoursSinceLastHarvest: number;
          estimatedGainWei: bigint;
          wouldBeProfitable: boolean;
      }
>;

type HarvestReportTransaction = Async<{
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
    decision: HarvestReportDecision | null;
    transaction: HarvestReportTransaction | null;

    // summary
    summary: {
        harvested: boolean;
        skipped: boolean;
        status: ReportAsyncStatus;
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
            statuses: {
                error: 0,
                'not-started': 0,
                info: 0,
                warning: 0,
                notice: 0,
                success: 0,
            },
        },
    };
}

export function createDefaultHarvestReportItem({ vault }: { vault: BeefyVault }): HarvestReportItem {
    return {
        vault,

        simulation: null,
        decision: null,
        transaction: null,

        summary: {
            harvested: false,
            skipped: false,
            status: 'not-started',
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
