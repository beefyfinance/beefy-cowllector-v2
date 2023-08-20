import axios from 'axios';
import { Chain } from './chain';
import { BeefyVault } from './vault';
import { BEEFY_API_URL, RPC_CONFIG } from '../util/config';
import { rootLogger } from '../util/logger';
import { Hex } from 'viem';
import { groupBy, keyBy } from 'lodash';

const logger = rootLogger.child({ module: 'vault-list' });

type ApiBeefyVault = {
    id: string;
    name: string;
    status: 'eol' | 'active';
    strategy: string;
    chain: Chain;
    // + some other fields we don't care about
};

export async function getVaultsToMonitor(options: {
    chains: Chain[];
    contractAddress: Hex | null;
}): Promise<Record<Chain, BeefyVault[]>> {
    const response = await axios.get<ApiBeefyVault[]>(`${BEEFY_API_URL}/vaults`);
    const rawVaults = response.data;

    // map to a simpler format
    const allVaults = rawVaults
        .map(vault => ({
            id: vault.id,
            eol: vault.status === 'eol',
            chain: vault.chain,
            strategy_address: vault.strategy as Hex,
        }))
        // remove eol vaults
        .filter(vault => !vault.eol)
        // remove eol chains
        .filter(vault => RPC_CONFIG[vault.chain].eol === false);

    logger.info({ msg: 'Got vaults from api', data: { vaultLength: allVaults.length } });

    // apply command line options
    let vaults = allVaults
        .filter(vault => options.chains.includes(vault.chain))
        .filter(vault => (options.contractAddress ? vault.strategy_address === options.contractAddress : true));
    logger.info({ msg: 'Filtered vaults', data: { vaultLength: vaults.length } });

    // remove duplicates
    const vaultsByStrategyAddress = keyBy(vaults, 'strategy_address');
    vaults = Object.values(vaultsByStrategyAddress);

    // split by chain
    const vaultsByChain = groupBy(vaults, 'chain') as Record<Chain, BeefyVault[]>;
    logger.debug({ msg: 'Vaults by chain', data: vaultsByChain });

    return vaultsByChain;
}
