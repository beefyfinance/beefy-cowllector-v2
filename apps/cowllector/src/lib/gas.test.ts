import { createGasEstimationReport } from './gas';

describe('gas', () => {
    it('should estimate transaction gain', () => {
        const input = {
            rawGasPrice: 100n,
            estimatedCallRewardsWei: 1000n,
            rawGasAmountEstimation: 100n,
            gasPriceMultiplier: 1.5,
            minExpectedRewardsWei: 0n,
        };
        expect(createGasEstimationReport(input)).toEqual({
            ...input,
            gasPrice: 150n,
            transactionCostEstimationWei: 15000n,
            estimatedGainWei: -14000n,
            wouldBeProfitable: false,
        });
    });

    it('should account for overestimation parameter', () => {
        const input = {
            rawGasPrice: 100n,
            estimatedCallRewardsWei: 1000n,
            rawGasAmountEstimation: 100n,
            gasPriceMultiplier: 1.0,
            minExpectedRewardsWei: 0n,
        };
        expect(createGasEstimationReport(input)).toEqual({
            ...input,
            gasPrice: 100n,
            transactionCostEstimationWei: 10000n,
            estimatedGainWei: -9000n,
            wouldBeProfitable: false,
        });
    });

    it('should decide if a call would be profitable', () => {
        const input = {
            rawGasPrice: 100n,
            estimatedCallRewardsWei: 1000000n,
            rawGasAmountEstimation: 100n,
            gasPriceMultiplier: 1.5,
            minExpectedRewardsWei: 0n,
        };
        expect(createGasEstimationReport(input)).toEqual({
            ...input,
            gasPrice: 150n,
            transactionCostEstimationWei: 15000n,
            estimatedGainWei: 985000n,
            wouldBeProfitable: true,
        });
    });

    it('should decide if a call would be profitable accounting for minExpectedRewards', () => {
        const input = {
            rawGasPrice: 100n,
            estimatedCallRewardsWei: 1000000n,
            rawGasAmountEstimation: 100n,
            gasPriceMultiplier: 1.5,
            minExpectedRewardsWei: 1000000n,
        };
        expect(createGasEstimationReport(input)).toEqual({
            ...input,
            gasPrice: 150n,
            transactionCostEstimationWei: 15000n,
            estimatedGainWei: 985000n,
            wouldBeProfitable: false,
        });
    });
});
