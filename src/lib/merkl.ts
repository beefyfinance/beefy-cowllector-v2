import type { BeefyVault } from './vault';

type RawMerklTokenData = {
    [tokenAddress: string]: {
        accumulated: string;
        unclaimed: string;
        pending: string;
        decimals: number;
        symbol: string;
        proof: string[];
    };
};

type RawMerklRewardsResponse = {
    [chainId: string]: {
        tokenData: RawMerklTokenData;
    };
};

export type MerklTokenData = {
    [chainId: string]: {
        [tokenAddress: string]: {
            accumulated: bigint;
            unclaimed: bigint;
            pending: bigint;
            decimals: number;
            symbol: string;
        };
    };
};

export function hasPendingMerklRewards(merklTokenData: MerklTokenData): boolean {
    for (const chainId of Object.keys(merklTokenData)) {
        for (const tokenData of Object.values(merklTokenData[chainId])) {
            if (tokenData.unclaimed > 0n) {
                return true;
            }
        }
    }
    return false;
}

export async function fetchMerklTokenData(vault: BeefyVault): Promise<MerklTokenData | null> {
    // only cowcentrated vaults have merkl
    if (!vault.isClmVault) {
        return null;
    }

    const url = `https://api.merkl.xyz/v3/rewards?user=${vault.strategyAddress}`;

    const response = await fetch(url);
    const data: RawMerklRewardsResponse = await response.json();

    const merklTokenData: MerklTokenData = {};
    for (const [chainId, chainData] of Object.entries(data)) {
        merklTokenData[chainId] = {};
        for (const [tokenAddress, tokenData] of Object.entries(chainData.tokenData)) {
            merklTokenData[chainId][tokenAddress] = {
                accumulated: BigInt(tokenData.accumulated),
                unclaimed: BigInt(tokenData.unclaimed),
                pending: BigInt(tokenData.pending),
                decimals: tokenData.decimals,
                symbol: tokenData.symbol,
            };
        }
    }

    return merklTokenData;
}
