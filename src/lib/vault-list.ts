import axios from 'axios';
import { Chain } from './chain';
import { BeefyVault, StrategyTypeId } from './vault';
import { BEEFY_API_URL } from './config';
import { rootLogger } from '../util/logger';
import { Hex } from 'viem';
import { groupBy, mapValues, uniqBy } from 'lodash';

const logger = rootLogger.child({ module: 'vault-list' });

async function fetchVaults() {
    type ApiBeefyVaultResponse = {
        id: string;
        name: string;
        status: 'eol' | 'active';
        strategy: string;
        chain: Chain;
        platformId: string;
        lastHarvest: number;
        strategyTypeId: StrategyTypeId;
        // + some other fields we don't care about
    }[];

    type ApiBeefyTvlResponse = {
        [key: string]: {
            // chain id
            [key: string]: number; // vault id -> tvl
        };
    };

    const vaultResponse = await axios.get<ApiBeefyVaultResponse>(`${BEEFY_API_URL}/harvestable-vaults`);
    const rawVaults = vaultResponse.data;

    const tvlResponse = await axios.get<ApiBeefyTvlResponse>(`${BEEFY_API_URL}/tvl`);
    const rawTvlByChains = tvlResponse.data;
    const rawTvls = Object.values(rawTvlByChains).reduce((acc, tvl) => ({ ...acc, ...tvl }), {});

    // map to a simpler format
    return rawVaults.map(vault => ({
        id: vault.id,
        eol: vault.status === 'eol',
        chain: vault.chain,
        strategyAddress: vault.strategy as Hex,
        platformId: vault.platformId,
        tvlUsd: rawTvls[vault.id] || 0,
        lastHarvest: new Date(vault.lastHarvest * 1000),
        strategyTypeId: vault.strategyTypeId || null,
    }));
}

export async function getVault(options: { chain: Chain; strategyAddress: Hex }): Promise<BeefyVault | null> {
    const vaults = await fetchVaults();
    const vault = vaults.find(
        vault => vault.chain === options.chain && vault.strategyAddress === options.strategyAddress
    );
    return vault || null;
}

export async function getVaultsToMonitorByChain(options: {
    chains: Chain[];
    strategyAddress: Hex | null;
}): Promise<Record<Chain, BeefyVault[]>> {
    const allVaults = await fetchVaults();

    logger.info({ msg: 'Got vaults from api', data: { vaultLength: allVaults.length } });
    // apply command line options
    let vaults = allVaults
        .filter(vault => options.chains.includes(vault.chain))
        .filter(vault => (options.strategyAddress ? vault.strategyAddress === options.strategyAddress : true));
    logger.info({ msg: 'Filtered vaults', data: { vaultLength: vaults.length } });

    // split by chain
    let vaultsByChain = groupBy(vaults, 'chain') as Record<Chain, BeefyVault[]>;
    logger.debug({ msg: 'Vaults by chain', data: vaultsByChain });

    // remove duplicate vaults by strategy address
    vaultsByChain = mapValues(vaultsByChain, vaults => uniqBy(vaults, 'strategyAddress'));

    for (const chain of options.chains) {
        if (!vaultsByChain[chain]) {
            vaultsByChain[chain] = [];
        }
    }

    return vaultsByChain;
}
