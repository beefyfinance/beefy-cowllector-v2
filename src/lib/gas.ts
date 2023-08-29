import { bigintMultiplyFloat } from '../util/bigint';
import { HARVEST_GAS_PRICE_MULTIPLIER } from './config';

export type GasEstimationReport = {
    // input values
    rawGasPrice: bigint;
    rawGasAmountEstimation: bigint;
    estimatedCallRewardsWei: bigint;
    gasPriceMultiplier: number;
    // computed values
    gasPrice: bigint;
    transactionCostEstimationWei: bigint;
    estimatedGainWei: bigint;
    wouldBeProfitable: boolean;
};

export function createGasEstimationReport({
    rawGasPrice,
    estimatedCallRewardsWei,
    rawGasAmountEstimation,
    gasPriceMultiplier = HARVEST_GAS_PRICE_MULTIPLIER,
}: {
    // current network gas price in wei
    rawGasPrice: bigint; // in wei
    // estimation of the gas amount required for the transaction
    rawGasAmountEstimation: bigint; // in gas units
    // estimation of the call rewards in wei
    estimatedCallRewardsWei: bigint; // in wei
    // multiply the gas price by some value to overestimate the gas cost
    gasPriceMultiplier?: number;
}): GasEstimationReport {
    const gasPrice = bigintMultiplyFloat(rawGasPrice, gasPriceMultiplier);
    const transactionCostEstimationWei = rawGasAmountEstimation * gasPrice;
    const estimatedGainWei = estimatedCallRewardsWei - transactionCostEstimationWei;
    const wouldBeProfitable = estimatedGainWei > 0;
    return {
        rawGasPrice,
        rawGasAmountEstimation,
        estimatedCallRewardsWei,
        gasPriceMultiplier,
        gasPrice,
        transactionCostEstimationWei,
        estimatedGainWei,
        wouldBeProfitable,
    };
}
