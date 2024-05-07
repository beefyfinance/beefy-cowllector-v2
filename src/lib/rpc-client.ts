import { createPublicClient, createWalletClient } from 'viem';
import { type Chain } from './chain';
import { privateKeyToAccount } from 'viem/accounts';
import { RPC_CONFIG } from './config';
import { gnosis, linea, mantle, type Chain as ViemChain } from 'viem/chains';
import {
    arbitrum,
    aurora,
    avalanche,
    base,
    bsc,
    canto,
    celo,
    cronos,
    fantom,
    fraxtal,
    fuse,
    kava,
    mainnet,
    harmonyOne,
    polygon,
    moonbeam,
    moonriver,
    metis,
    optimism,
    polygonZkEvm,
    zkSync,
} from 'viem/chains';
import { loggingHttpTransport } from './rpc-transport';
import { createCustomHarvestWalletActions } from './harvest-actions';
import { createCustomRpcPublicActions, createCustomRpcWalletActions } from './rpc-actions';
import { memoize } from 'lodash';

function applyConfig(chain: Chain, viemChain: ViemChain): ViemChain {
    const rpcConfig = RPC_CONFIG[chain];

    return {
        ...viemChain,
        fees: {
            ...viemChain.fees,
            baseFeeMultiplier: rpcConfig.transaction.baseFeeMultiplier,
        },
        rpcUrls: {
            default: { http: [rpcConfig.url] },
            public: { http: [rpcConfig.url] },
        },
    };
}

const VIEM_CHAINS: Record<Chain, ViemChain | null> = {
    arbitrum: applyConfig('arbitrum', arbitrum),
    aurora: applyConfig('aurora', aurora),
    avax: applyConfig('avax', avalanche),
    base: applyConfig('base', base),
    bsc: applyConfig('bsc', bsc),
    canto: applyConfig('canto', canto),
    celo: applyConfig('celo', celo),
    cronos: applyConfig('cronos', cronos),
    emerald: null,
    ethereum: applyConfig('ethereum', mainnet),
    fantom: applyConfig('fantom', fantom),
    fraxtal: applyConfig('fraxtal', fraxtal),
    fuse: applyConfig('fuse', fuse),
    gnosis: applyConfig('gnosis', gnosis),
    heco: null,
    kava: applyConfig('kava', kava),
    linea: applyConfig('linea', linea),
    mantle: applyConfig('mantle', mantle),
    metis: applyConfig('metis', metis),
    moonbeam: applyConfig('moonbeam', moonbeam),
    moonriver: applyConfig('moonriver', moonriver),
    one: applyConfig('one', harmonyOne),
    optimism: applyConfig('optimism', optimism),
    polygon: applyConfig('polygon', polygon),
    zkevm: applyConfig('zkevm', polygonZkEvm),
    zksync: applyConfig('zksync', zkSync),
};

// the view read only client has more options for batching
export const getReadOnlyRpcClient = memoize(
    ({ chain }: { chain: Chain }) => {
        const rpcConfig = RPC_CONFIG[chain];
        const viemChain = VIEM_CHAINS[chain];
        if (!viemChain) {
            throw new Error(`Unsupported viem chain ${chain}`);
        }
        return createPublicClient({
            chain: viemChain,
            transport: loggingHttpTransport(rpcConfig.url, {
                batch: rpcConfig.batch.jsonRpc,
                timeout: rpcConfig.timeoutMs,
                retryCount: rpcConfig.retry.maxAttempts,
                retryDelay: rpcConfig.retry.exponentialDelayMs,
            }),
            batch: {
                multicall: rpcConfig.batch.multicall,
            },
        }).extend(createCustomRpcPublicActions({ chain }));
    },
    ({ chain }) => chain
);

type PublicClient = Awaited<ReturnType<typeof getReadOnlyRpcClient>>;

export const getWalletClient = memoize(
    ({ chain }: { chain: Chain }) => {
        const rpcConfig = RPC_CONFIG[chain];
        const viemChain = VIEM_CHAINS[chain];
        if (!viemChain) {
            throw new Error(`Unsupported chain ${chain}`);
        }
        return createWalletClient({
            chain: viemChain,
            account: getWalletAccount({ chain }),
            transport: loggingHttpTransport(rpcConfig.url, {
                batch: false,
                timeout: rpcConfig.timeoutMs,
                retryCount: rpcConfig.retry.maxAttempts,
                retryDelay: rpcConfig.retry.exponentialDelayMs,
            }),
        })
            .extend(createCustomHarvestWalletActions({ chain }))
            .extend(createCustomRpcWalletActions({ chain }));
    },
    ({ chain }) => chain
);
type WalletClient = Awaited<ReturnType<typeof getWalletClient>>;

export const getWalletAccount = memoize(
    ({ chain }: { chain: Chain }) => {
        const rpcConfig = RPC_CONFIG[chain];
        const pk = rpcConfig.account.privateKey;
        return privateKeyToAccount(pk);
    },
    ({ chain }) => chain
);

type WalletAccount = Awaited<ReturnType<typeof getWalletAccount>>;

type RpcActionParams = {
    publicClient: PublicClient;
    walletClient: WalletClient;
    walletAccount: WalletAccount;
    rpcConfig: (typeof RPC_CONFIG)[Chain];
};

export const getRpcActionParams = memoize(
    ({ chain }: { chain: Chain }): RpcActionParams => {
        const rpcConfig = RPC_CONFIG[chain];
        return {
            publicClient: getReadOnlyRpcClient({ chain }),
            walletClient: getWalletClient({ chain }),
            walletAccount: getWalletAccount({ chain }),
            rpcConfig,
        };
    },
    ({ chain }) => chain
);
