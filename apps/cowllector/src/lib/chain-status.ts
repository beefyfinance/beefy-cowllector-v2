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

export type BeefyChainApiStatuses = Partial<Record<string, string | undefined>>;

async function fetchBeefyChainStatuses(): Promise<BeefyChainApiStatuses> {
    const response = await axios.get<ApiBeefyChainsResponse>(`${BEEFY_API_URL}/chains?_cache_buster=${Date.now()}`);
    const statuses: BeefyChainApiStatuses = {};
    for (const [chainId, chain] of Object.entries(response.data ?? {})) {
        statuses[chainId] = chain?.status;
    }
    return statuses;
}

/**
 * A chain is eol if the local config says so, or if Beefy API `/chains` does not report `status: "active"`.
 * Config eol is a required extra check so a chain cannot be reactivated from the API alone.
 * `apiStatuses === null` means the API request failed; only the local config is used.
 */
export function isChainEol(chain: Chain, apiStatuses: BeefyChainApiStatuses | null): boolean {
    if (RPC_CONFIG[chain].eol) {
        return true;
    }
    if (apiStatuses === null) {
        return false;
    }
    return apiStatuses[chain] !== 'active';
}

export async function getBeefyChainApiStatuses(): Promise<BeefyChainApiStatuses | null> {
    try {
        const statuses = await fetchBeefyChainStatuses();
        logger.info({
            msg: 'Got chain statuses from api',
            data: {
                active: allChainIds.filter((chain) => !isChainEol(chain, statuses)),
                eol: allChainIds.filter((chain) => isChainEol(chain, statuses)),
            },
        });
        return statuses;
    } catch (error) {
        logger.error({
            msg: 'Failed to fetch chain statuses from api, using local config only',
            data: { error },
        });
        return null;
    }
}
