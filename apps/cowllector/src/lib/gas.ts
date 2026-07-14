import { bigintMultiplyFloat } from '../util/bigint';

export type GasEstimationReport = {
    // input values
    rawGasPrice: bigint;
    rawGasAmountEstimation: bigint;
    estimatedCallRewardsWei: bigint;
    gasPriceMultiplier: number;
    minExpectedRewardsWei: bigint;
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
    gasPriceMultiplier,
    minExpectedRewardsWei,
}: {
    // current network gas price in wei
    rawGasPrice: bigint; // in wei
    // estimation of the gas amount required for the transaction
    rawGasAmountEstimation: bigint; // in gas units
    // estimation of the call rewards in wei
    estimatedCallRewardsWei: bigint; // in wei
    // multiply the gas price by some value to overestimate the gas cost
    gasPriceMultiplier: number;
    // is profitable if the estimated gain is greater than this value
    minExpectedRewardsWei: bigint;
}): GasEstimationReport {
    const gasPrice = bigintMultiplyFloat(rawGasPrice, gasPriceMultiplier);
    const transactionCostEstimationWei = rawGasAmountEstimation * gasPrice;
    const estimatedGainWei = estimatedCallRewardsWei - transactionCostEstimationWei;
    const wouldBeProfitable = estimatedGainWei > minExpectedRewardsWei;
    return {
        rawGasPrice,
        rawGasAmountEstimation,
        estimatedCallRewardsWei,
        gasPriceMultiplier,
        minExpectedRewardsWei,
        gasPrice,
        transactionCostEstimationWei,
        estimatedGainWei,
        wouldBeProfitable,
    };
}
