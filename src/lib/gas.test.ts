import { GasEstimationResult, createGasEstimationReport } from './gas';

describe('gas', () => {
    it('should estimate transaction gain', () => {
        const input = {
            rawGasPrice: 100n,
            estimatedCallRewardsWei: 1000n,
            rawGasAmountEstimation: { from: 'cache', estimation: 100n } satisfies GasEstimationResult,
            gasPriceMultiplier: 1.5,
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
            rawGasAmountEstimation: { from: 'cache', estimation: 100n } satisfies GasEstimationResult,
            gasPriceMultiplier: 1.0,
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
            rawGasAmountEstimation: { from: 'cache', estimation: 100n } satisfies GasEstimationResult,
            gasPriceMultiplier: 1.5,
        };
        expect(createGasEstimationReport(input)).toEqual({
            ...input,
            gasPrice: 150n,
            transactionCostEstimationWei: 15000n,
            estimatedGainWei: 985000n,
            wouldBeProfitable: true,
        });
    });
});
