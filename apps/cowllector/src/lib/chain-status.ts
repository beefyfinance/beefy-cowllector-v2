import axios from 'axios';
import { rootLogger } from '../util/logger';
import { allChainIds, type Chain } from './chain';
import { BEEFY_API_URL, RPC_CONFIG } from './config';

const logger = rootLogger.child({ module: 'chain-status' });

type ApiBeefyChain = {
    id?: string;
    status?: string;
};

type ApiBeefyChainsResponse = Record<string, ApiBeefyChain>;

/**
 * Beefy API `/chains` is the source of truth for whether a chain is active.
 * Only `status: "active"` is harvested; anything else (including missing chains) is eol.
 */
export function getEolByChainFromApiStatuses(statuses: Partial<Record<string, string | undefined>>): Record<Chain, boolean> {
    const eolByChain = {} as Record<Chain, boolean>;
    for (const chain of allChainIds) {
        eolByChain[chain] = statuses[chain] !== 'active';
    }
    return eolByChain;
}

function getEolByChainFromLocalConfig(): Record<Chain, boolean> {
    const eolByChain = {} as Record<Chain, boolean>;
    for (const chain of allChainIds) {
        eolByChain[chain] = RPC_CONFIG[chain].eol;
    }
    return eolByChain;
}

async function fetchBeefyChainStatuses(): Promise<Partial<Record<string, string | undefined>>> {
    const response = await axios.get<ApiBeefyChainsResponse>(`${BEEFY_API_URL}/chains?_cache_buster=${Date.now()}`);
    const statuses: Partial<Record<string, string | undefined>> = {};
    for (const [chainId, chain] of Object.entries(response.data ?? {})) {
        statuses[chainId] = chain?.status;
    }
    return statuses;
}

export async function getEolByChain(): Promise<Record<Chain, boolean>> {
    try {
        const statuses = await fetchBeefyChainStatuses();
        const eolByChain = getEolByChainFromApiStatuses(statuses);
        logger.info({
            msg: 'Got chain statuses from api',
            data: {
                active: allChainIds.filter((chain) => !eolByChain[chain]),
                eol: allChainIds.filter((chain) => eolByChain[chain]),
            },
        });
        return eolByChain;
    } catch (error) {
        logger.error({
            msg: 'Failed to fetch chain statuses from api, falling back to local config',
            data: { error },
        });
        return getEolByChainFromLocalConfig();
    }
}
