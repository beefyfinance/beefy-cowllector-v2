import type { RpcConfig } from './rpc-config';
import { getHarvestTimeBucket } from './should-harvest';
import type { BeefyVault } from './vault';

function createMockVault(options: {
    tvlUsd: number;
    isClmVault?: boolean;
    isClmManager?: boolean;
}): BeefyVault {
    return {
        id: 'test-vault',
        eol: false,
        chain: 'ethereum',
        strategyAddress: '0x0000000000000000000000000000000000000000',
        platformId: 'test-platform',
        tvlUsd: options.tvlUsd,
        lastHarvest: null,
        strategyTypeId: null,
        isClmManager: options.isClmManager ?? false,
        isClmVault: options.isClmVault ?? false,
    };
}

function createMockRpcConfig(
    harvestBuckets: RpcConfig['harvest']['classicVaultHarvestTimeBuckets'],
    clmBuckets: RpcConfig['harvest']['clmVaultHarvestTimeBuckets'],
    clmManagerTimeBetweenHarvestsMs: number = 24 * 60 * 60 * 1000
): RpcConfig {
    return {
        url: 'https://test.rpc',
        eol: false,
        timeoutMs: 60000,
        batch: {
            jsonRpc: undefined,
            multicall: false,
        },
        retry: {
            maxAttempts: 3,
            exponentialDelayMs: 1000,
        },
        transaction: {
            type: 'legacy',
            maxNativePerTransactionWei: null,
            maxGasPricePerTransactionWei: null,
            totalTries: 1,
            forceGasPrice: {
                maxFeePerGas: null,
                maxPriorityFeePerGas: null,
                gasPrice: null,
            },
            retryGasMultiplier: {
                gasPrice: 1.2,
                maxFeePerGas: 1.2,
                maxPriorityFeePerGas: 1.2,
            },
            baseFeeMultiplier: 1.5,
            receipt: {
                blockConfirmations: 1,
                notFoundErrorRetryCount: 3,
                notFoundErrorRetryDelayMs: 1000,
                receiptTimeoutMs: 60000,
            },
        },
        contracts: {
            harvestLens: null,
            deployer: null,
            revenueBridge: null,
        },
        account: {
            privateKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
        },
        harvest: {
            enabled: true,
            clmManagerTimeBetweenHarvestsMs: clmManagerTimeBetweenHarvestsMs,
            classicVaultHarvestTimeBuckets: harvestBuckets,
            clmVaultHarvestTimeBuckets: clmBuckets,
            setTransactionGasLimit: true,
            parallelSimulations: 5,
            profitabilityCheck: {
                enabled: false,
                minExpectedRewardsWei: BigInt(0),
            },
            balanceCheck: {
                gasPriceMultiplier: 1.5,
                gasLimitMultiplier: 2.5,
                minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: 2,
            },
        },
        unwrap: {
            enabled: true,
            minAmountOfWNativeWei: BigInt(0),
            maxAmountOfNativeWei: BigInt(0),
            setTransactionGasLimit: true,
            balanceCheck: {
                minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: 1.5,
            },
        },
        revenueBridgeHarvest: {
            enabled: false,
            forceGasLimit: null,
            setTransactionGasLimit: true,
            balanceCheck: {
                minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: 1.5,
            },
        },
        alerting: {
            networkCongestionWaitInDays: 5,
            walletBalanceTooLowAlert: true,
        },
    };
}

describe('getHarvestTimeBucket', () => {
    it('should return null when TVL is below all thresholds', () => {
        const rpcConfig = createMockRpcConfig([{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 }], []);
        const vault = createMockVault({ tvlUsd: 50 });

        expect(
            getHarvestTimeBucket({
                vault,
                rpcConfig,
            })
        ).toBeNull();
    });

    it('should return the highest matching bucket when TVL meets threshold', () => {
        const rpcConfig = createMockRpcConfig(
            [
                { minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 },
                { minTvlThresholdUsd: 1000, targetTimeBetweenHarvestsMs: 1800000 },
                { minTvlThresholdUsd: 10000, targetTimeBetweenHarvestsMs: 900000 },
            ],
            []
        );

        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 100 }),
                rpcConfig,
            })
        ).toEqual({ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 });
        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 5000 }),
                rpcConfig,
            })
        ).toEqual({ minTvlThresholdUsd: 1000, targetTimeBetweenHarvestsMs: 1800000 });
        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 50000 }),
                rpcConfig,
            })
        ).toEqual({ minTvlThresholdUsd: 10000, targetTimeBetweenHarvestsMs: 900000 });
    });

    it('should handle edge cases', () => {
        const rpcConfig = createMockRpcConfig([{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 }], []);

        // Empty buckets
        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 100 }),
                rpcConfig: createMockRpcConfig([], []),
            })
        ).toBeNull();

        // Single bucket
        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 200 }),
                rpcConfig,
            })
        ).toEqual({ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 });
    });

    it('should throw error when buckets are not ordered', () => {
        const rpcConfig = createMockRpcConfig(
            [
                { minTvlThresholdUsd: 1000, targetTimeBetweenHarvestsMs: 1800000 },
                { minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 },
            ],
            []
        );

        expect(() =>
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 100 }),
                rpcConfig,
            })
        ).toThrow('Harvest time buckets must be ordered by minTvlThresholdUsd (ascending)');
    });

    it('should throw error when buckets have duplicate thresholds', () => {
        const rpcConfig = createMockRpcConfig(
            [
                { minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 },
                { minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 1800000 },
            ],
            []
        );

        expect(() =>
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 100 }),
                rpcConfig,
            })
        ).toThrow('Harvest time buckets must not have duplicate thresholds');
    });

    it('should throw error when CLM buckets have duplicate thresholds', () => {
        const rpcConfig = createMockRpcConfig(
            [],
            [
                { minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 },
                { minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 1800000 },
            ]
        );

        expect(() =>
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 100, isClmVault: true }),
                rpcConfig,
            })
        ).toThrow('Harvest time buckets must not have duplicate thresholds');
    });

    it('should use correct buckets based on vault type', () => {
        const rpcConfig = createMockRpcConfig(
            [{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 }],
            [{ minTvlThresholdUsd: 200, targetTimeBetweenHarvestsMs: 1800000 }]
        );

        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 150, isClmVault: false }),
                rpcConfig,
            })
        ).toEqual({ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 });

        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 150, isClmVault: true }),
                rpcConfig,
            })
        ).toBeNull();
        expect(
            getHarvestTimeBucket({
                vault: createMockVault({ tvlUsd: 250, isClmVault: true }),
                rpcConfig,
            })
        ).toEqual({ minTvlThresholdUsd: 200, targetTimeBetweenHarvestsMs: 1800000 });
    });

    describe('CLM manager harvest time requirements', () => {
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000; // 86400000 ms

        it('should always return configured time for CLM manager, ignoring buckets and TVL', () => {
            const rpcConfig = createMockRpcConfig(
                [{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 }],
                [{ minTvlThresholdUsd: 200, targetTimeBetweenHarvestsMs: 1800000 }],
                TWENTY_FOUR_HOURS_MS
            );

            expect(
                getHarvestTimeBucket({
                    vault: createMockVault({ tvlUsd: 50, isClmVault: true, isClmManager: true }),
                    rpcConfig,
                })
            ).toEqual({ minTvlThresholdUsd: 0, targetTimeBetweenHarvestsMs: TWENTY_FOUR_HOURS_MS });
        });

        it('should return configured time for CLM manager when buckets are empty', () => {
            const rpcConfig = createMockRpcConfig([], [], TWENTY_FOUR_HOURS_MS);

            expect(
                getHarvestTimeBucket({
                    vault: createMockVault({ tvlUsd: 100, isClmVault: true, isClmManager: true }),
                    rpcConfig,
                })
            ).toEqual({ minTvlThresholdUsd: 0, targetTimeBetweenHarvestsMs: TWENTY_FOUR_HOURS_MS });
        });

        it('should return configured time for CLM manager regardless of bucket values', () => {
            const rpcConfig = createMockRpcConfig(
                [],
                [{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 48 * 60 * 60 * 1000 }], // 48 hours
                TWENTY_FOUR_HOURS_MS
            );

            expect(
                getHarvestTimeBucket({
                    vault: createMockVault({ tvlUsd: 200, isClmVault: true, isClmManager: true }),
                    rpcConfig,
                })
            ).toEqual({ minTvlThresholdUsd: 0, targetTimeBetweenHarvestsMs: TWENTY_FOUR_HOURS_MS });
        });

        it('should return configured time for CLM manager even when bucket has shorter interval', () => {
            const rpcConfig = createMockRpcConfig(
                [],
                [{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 12 * 60 * 60 * 1000 }], // 12 hours
                TWENTY_FOUR_HOURS_MS
            );

            expect(
                getHarvestTimeBucket({
                    vault: createMockVault({ tvlUsd: 200, isClmVault: true, isClmManager: true }),
                    rpcConfig,
                })
            ).toEqual({ minTvlThresholdUsd: 0, targetTimeBetweenHarvestsMs: TWENTY_FOUR_HOURS_MS });
        });

        it('should use custom configured time for CLM manager', () => {
            const CUSTOM_TIME_MS = 12 * 60 * 60 * 1000; // 12 hours
            const rpcConfig = createMockRpcConfig(
                [],
                [{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 48 * 60 * 60 * 1000 }], // 48 hours
                CUSTOM_TIME_MS
            );

            expect(
                getHarvestTimeBucket({
                    vault: createMockVault({ tvlUsd: 200, isClmVault: true, isClmManager: true }),
                    rpcConfig,
                })
            ).toEqual({ minTvlThresholdUsd: 0, targetTimeBetweenHarvestsMs: CUSTOM_TIME_MS });
        });

        it('should not affect non-CLM manager vaults when TVL is below all thresholds', () => {
            const rpcConfig = createMockRpcConfig(
                [{ minTvlThresholdUsd: 100, targetTimeBetweenHarvestsMs: 3600000 }],
                []
            );

            expect(
                getHarvestTimeBucket({
                    vault: createMockVault({ tvlUsd: 50, isClmVault: false, isClmManager: false }),
                    rpcConfig,
                })
            ).toBeNull();
        });

        it('should not affect CLM vaults that are not managers', () => {
            const rpcConfig = createMockRpcConfig(
                [],
                [{ minTvlThresholdUsd: 200, targetTimeBetweenHarvestsMs: 1800000 }]
            );

            expect(
                getHarvestTimeBucket({
                    vault: createMockVault({ tvlUsd: 50, isClmVault: true, isClmManager: false }),
                    rpcConfig,
                })
            ).toBeNull();
        });
    });
});
