import { createPublicClient, createWalletClient } from 'viem';
import { type Chain } from './chain';
import { privateKeyToAccount } from 'viem/accounts';
import { RPC_CONFIG } from './config';
import { gnosis, type Chain as ViemChain } from 'viem/chains';
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
import { addressBook } from 'blockchain-addressbook';
import { loggingHttpTransport } from './rpc-transport';
import { createCustomHarvestWalletActions } from './harvest-actions';
import { cachedFactory } from '../util/cache';
import { createCustomRpcPublicActions, createCustomRpcWalletActions } from './rpc-actions';

const fuse = {
    id: addressBook.fuse.tokens.FUSE.chainId,
    name: 'Fuse',
    network: 'fuse',
    nativeCurrency: {
        decimals: addressBook.fuse.tokens.FUSE.decimals,
        name: addressBook.fuse.tokens.FUSE.name,
        symbol: addressBook.fuse.tokens.FUSE.name,
    },
    rpcUrls: {
        // we will use our own http transport anyway
        public: { http: [] },
        default: { http: [] },
    },
    blockExplorers: {
        default: { name: 'Fuse Explorer', url: 'https://explorer.fuse.io' },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 16_146_628,
        },
    },
} as const satisfies ViemChain;

const kava = {
    id: addressBook.kava.tokens.KAVA.chainId,
    name: 'Kava',
    network: 'kava',
    nativeCurrency: {
        decimals: addressBook.kava.tokens.KAVA.decimals,
        name: addressBook.kava.tokens.KAVA.name,
        symbol: addressBook.kava.tokens.KAVA.name,
    },
    rpcUrls: {
        // we will use our own http transport anyway
        public: { http: [] },
        default: { http: [] },
    },
    blockExplorers: {
        default: { name: 'Kava Explorer', url: 'https://explorer.kava.io/' },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 3_661_165,
        },
    },
} as const satisfies ViemChain;

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
    fantom: applyConfig('fantom', fantom),
    ethereum: applyConfig('ethereum', mainnet),
    emerald: null,
    one: applyConfig('one', harmonyOne),
    heco: null,
    fuse: applyConfig('fuse', fuse),
    gnosis: applyConfig('gnosis', gnosis),
    kava: applyConfig('kava', kava),
    polygon: applyConfig('polygon', polygon),
    moonbeam: applyConfig('moonbeam', moonbeam),
    moonriver: applyConfig('moonriver', moonriver),
    metis: applyConfig('metis', metis),
    optimism: applyConfig('optimism', optimism),
    zkevm: applyConfig('zkevm', polygonZkEvm),
    zksync: applyConfig('zksync', zkSync),
};

// the view read only client has more options for batching
export const getReadOnlyRpcClient = cachedFactory(
    ({ chain }: { chain: Chain }) => chain,
    ({ chain }) => {
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
            }),
            batch: {
                multicall: rpcConfig.batch.multicall,
            },
        }).extend(createCustomRpcPublicActions({ chain }));
    }
);

type PublicClient = Awaited<ReturnType<typeof getReadOnlyRpcClient>>;

export const getWalletClient = cachedFactory(
    ({ chain }: { chain: Chain }) => chain,
    ({ chain }) => {
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
            }),
        })
            .extend(createCustomHarvestWalletActions({ chain }))
            .extend(createCustomRpcWalletActions({ chain }));
    }
);
type WalletClient = Awaited<ReturnType<typeof getWalletClient>>;

export const getWalletAccount = cachedFactory(
    ({ chain }: { chain: Chain }) => chain,
    ({ chain }) => {
        const rpcConfig = RPC_CONFIG[chain];
        const pk = rpcConfig.account.privateKey;
        return privateKeyToAccount(pk);
    }
);

type WalletAccount = Awaited<ReturnType<typeof getWalletAccount>>;

type RpcActionParams = {
    publicClient: PublicClient;
    walletClient: WalletClient;
    walletAccount: WalletAccount;
    rpcConfig: (typeof RPC_CONFIG)[Chain];
};

export const getRpcActionParams = cachedFactory(
    ({ chain }: { chain: Chain }) => chain,
    ({ chain }): RpcActionParams => {
        const rpcConfig = RPC_CONFIG[chain];
        return {
            publicClient: getReadOnlyRpcClient({ chain }),
            walletClient: getWalletClient({ chain }),
            walletAccount: getWalletAccount({ chain }),
            rpcConfig,
        };
    }
);
