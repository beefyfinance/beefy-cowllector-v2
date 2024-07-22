import type { Hex } from 'viem';
import type { Async, TimingData } from '../util/async';
import type { Chain } from './chain';
import type { CollectorBalance } from './collector-balance';
import type { GasEstimationReport } from './gas';
import type { ReportAsyncStatus } from './report-error-status';
import { type AItem, type AKey, type AVal, reportOnMultipleAsyncCall, reportOnSingleAsyncCall } from './reports';
import type { BeefyVault } from './vault';

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
          shouldHarvest: true;
          blindHarvestDate: Date;
          level: 'info';
      }
    | {
          shouldHarvest: false;
          blindHarvestDate: Date;
          level: 'info';
          notHarvestingReason: 'Blind harvest date not reached yet';
      }
    | {
          shouldHarvest: false;
          level: 'info';
          hoursSinceLastHarvest: number;
          notHarvestingReason: 'harvested would fail but the vault was harvested recently, there is probably no rewards to swap';
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
          level: 'info';
          notHarvestingReason: 'harvest would fail but it is an aura vault, so it might just be out of rewards';
      }
    | {
          shouldHarvest: false;
          level: 'notice';
          harvestReturnData: Hex;
          blockNumber: bigint;
          notHarvestingReason: 'We are ok not harvesting this vault';
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
          mightNeedEOL: true;
          notHarvestingReason: 'estimated call rewards is 0, but this vault is notoriously slow to refill rewards';
      }
    | {
          shouldHarvest: false;
          hoursSinceLastHarvest: number;
          level: 'error';
          mightNeedEOL: true;
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
          shouldHarvest: false;
          level: 'warning' | 'error';
          maxNativePerTransactionWei: bigint;
          transactionCostEstimationWei: bigint;
          notHarvestingReason: 'estimated transaction cost would be too high, waiting until the network is less congested';
      }
    | {
          shouldHarvest: false;
          level: 'warning' | 'error';
          maxGasPricePerTransactionWei: bigint;
          gasPrice: bigint;
          notHarvestingReason: 'estimated gas price would be too high, waiting until the network is less congested';
      }
    | {
          shouldHarvest: true;
          level: 'info';
          callRewardsWei: bigint;
          hoursSinceLastHarvest: number;
          estimatedGainWei: bigint;
          wouldBeProfitable: boolean;
      }

    // this is an unused decision just to keep typescript happy about the warning level
    // remove the warning level altogether when ready as we use grafana alerts now
    | {
          shouldHarvest: false;
          level: 'warning';
          notHarvestingReason: 'legacy decision leve';
      }
>;

type HarvestReportTransaction = Async<{
    transactionHash: Hex;
    blockNumber: bigint;
    gasUsed: bigint;
    effectiveGasPrice: bigint;
    transactionCostWei: bigint;
    balanceBeforeWei: bigint;
    estimatedProfitWei: bigint;
}>;

export type HarvestReportItem = {
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
        discordMessage: string | null;
        discordVaultLink: string | null;
        discordStrategyLink: string | null;
        discordTransactionLink: string | null;
    };
};

export function createDefaultHarvestReport({
    chain,
}: {
    chain: Chain;
}): HarvestReport {
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

export function createDefaultHarvestReportItem({
    vault,
}: {
    vault: BeefyVault;
}): HarvestReportItem {
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
            discordMessage: null,
            discordVaultLink: null,
            discordStrategyLink: null,
            discordTransactionLink: null,
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
