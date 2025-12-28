import type { RpcConfig } from './rpc-config';
import type { BeefyVault } from './vault';

/**
 * Returns the harvest time bucket that matches the vault's TVL.
 * The buckets should be ordered by minTvlThresholdUsd in ascending order with no duplicates.
 * Returns null if no bucket matches (i.e., TVL is below all thresholds).
 *
 * @param options - Configuration options
 * @param options.vault - The vault to check
 * @param options.rpcConfig - The RPC configuration containing harvest time buckets
 * @returns An object containing the minTvlThresholdUsd and targetTimeBetweenHarvestsMs, or null if no bucket matches
 * @throws Error if buckets are not ordered by minTvlThresholdUsd or contain duplicate thresholds
 */
export function getHarvestTimeBucket(options: {
    vault: BeefyVault;
    rpcConfig: RpcConfig;
}): { minTvlThresholdUsd: number; targetTimeBetweenHarvestsMs: number } | null {
    const { vault, rpcConfig } = options;

    const buckets = vault.isClmVault ? rpcConfig.harvest.clmHarvestTimeBuckets : rpcConfig.harvest.harvestTimeBuckets;

    // Validate that buckets are ordered by minTvlThresholdUsd (ascending) and have no duplicates
    for (let i = 1; i < buckets.length; i++) {
        const prevThreshold = buckets[i - 1].minTvlThresholdUsd;
        const currThreshold = buckets[i].minTvlThresholdUsd;

        if (currThreshold < prevThreshold) {
            throw new Error(
                `Harvest time buckets must be ordered by minTvlThresholdUsd (ascending). Found bucket at index ${i - 1} with threshold ${prevThreshold} followed by bucket at index ${i} with threshold ${currThreshold}.`
            );
        }

        if (currThreshold === prevThreshold) {
            throw new Error(
                `Harvest time buckets must not have duplicate thresholds. Found duplicate threshold ${currThreshold} at indices ${i - 1} and ${i}.`
            );
        }
    }

    // Find the highest threshold bucket where TVL meets or exceeds the threshold
    // Iterate in reverse to find the highest matching threshold
    for (let i = buckets.length - 1; i >= 0; i--) {
        const bucket = buckets[i];
        if (vault.tvlUsd >= bucket.minTvlThresholdUsd) {
            return {
                minTvlThresholdUsd: bucket.minTvlThresholdUsd,
                targetTimeBetweenHarvestsMs: bucket.targetTimeBetweenHarvestsMs,
            };
        }
    }

    // No bucket matches, return null (should not harvest)
    return null;
}
