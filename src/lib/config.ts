import dotenv from 'dotenv';
import { allChainIds, type Chain } from './chain';
import { allLogLevels } from '../util/logger-type';
import type { LogLevels } from '../util/logger-type';
import type { RpcConfig } from './rpc-config';
import { Hex } from 'viem';
dotenv.config();

const timezone = process.env.TZ;
if (timezone !== 'UTC') {
    throw new Error('Please set TZ=UTC in your .env file or command line');
}

export const REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';
export const BEEFY_API_URL = process.env.BEEFY_API_URL || 'https://api.beefy.finance';

const log_level = process.env.LOG_LEVEL || 'info';
if (!allLogLevels.includes(log_level as LogLevels)) {
    throw new Error(`Invalid log level ${log_level}`);
}

export const LOG_LEVEL: LogLevels = log_level as LogLevels;

const RPC_FORCE_URL = process.env.RPC_FORCE_URL || null;
const PRIVATE_KEY = (process.env.PRIVATE_KEY || null) as Hex | null;
export const DISABLE_COLLECTOR_FOR_CHAINS: Chain[] = (
    process.env.DISABLE_COLLECTOR_FOR_CHAINS ? process.env.DISABLE_COLLECTOR_FOR_CHAINS.split(',') : []
).filter(chain => allChainIds.includes(chain as Chain)) as Chain[];
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || null;
export const DISCORD_NOTIFY_UNEVENTFUL_HARVEST = process.env.DISCORD_NOTIFY_UNEVENTFUL_HARVEST === 'true';
export const DISCORD_PING_ROLE_IDS_ON_ERROR = process.env.DISCORD_PING_ROLE_IDS_ON_ERROR
    ? process.env.DISCORD_PING_ROLE_IDS_ON_ERROR.split(',')
    : [];
export const HARVEST_AT_LEAST_EVERY_HOURS = parseInt(process.env.HARVEST_AT_LEAST_EVERY_HOURS || '24', 10);
export const HARVEST_GAS_PRICE_MULTIPLIER = parseFloat(process.env.HARVEST_GAS_PRICE_MULTIPLIER || '1.5');
export const HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER = parseFloat(process.env.HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER || '2.5');
export const HARVEST_CACHE_GAS_ESTIMATIONS_SECONDS = parseInt(
    process.env.HARVEST_CACHE_GAS_ESTIMATIONS_SECONDS || '604800',
    10
); // 1 week default
export const HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER = parseFloat(process.env.HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER || '2');

const defaultBatch: RpcConfig['batch'] = {
    jsonRpc: {
        batchSize: 1,
        wait: undefined,
    },
    multicall: {
        batchSize: 4_096,
        wait: 100,
    },
};
const defaultContracts: RpcConfig['contracts'] = {
    harvestLens: '0xa9b924a0AaFad0e6aAE25410bc16C205446A11D2',
    deployer: '0xcc536552A6214d6667fBC3EC38965F7f556A6391',
};
const defaultAccount: RpcConfig['account'] = {
    privateKey: PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
};
const defaultTransactionConfig: RpcConfig['transaction'] = {
    type: 'eip1559' as const,
    retries: 3,
    retryGasMultiplier: 1.2, // up gas by 20% on each retry
    blockConfirmations: 3,
    timeoutMs: 5 * 60 * 1000,
    pollingIntervalMs: 5 * 1000,
    baseFeeMultiplier: 1.25, // 25% above base fee
};
const defaultTimeoutMs: RpcConfig['timeoutMs'] = 60_000; // high timeout because we batch calls
const defaultUnwrapConfig: RpcConfig['unwrap'] = {
    // default to 0.001 wnative (18 decimals)
    triggerAmountWei: 1_000_000_000_000_000n,
};
const defaultTvLConfig: RpcConfig['tvl'] = {
    minThresholdUsd: 100,
};
const defaultConfig: RpcConfig = {
    eol: false,
    url: 'changeme',
    timeoutMs: defaultTimeoutMs,
    batch: defaultBatch,
    contracts: defaultContracts,
    account: defaultAccount,
    transaction: defaultTransactionConfig,
    unwrap: defaultUnwrapConfig,
    tvl: defaultTvLConfig,
};

export const RPC_CONFIG: Record<Chain, RpcConfig> = {
    arbitrum: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ARBITRUM_RPC_URL || 'https://rpc.ankr.com/arbitrum',
        contracts: {
            ...defaultContracts,
            harvestLens: '0xEeD0329C9D10dD0D85461203f89a54eD5A7B8418',
        },
        gasConfig: {
            estimateContractGas: {
                // we don't use this gas price after the gas estimation so it's value isn't important
                // but ankr rpc will fail with a "gas is too high!" error when using the default provided by viem (1.5Gwei)
                // watch viemChain.fees for updates: https://github.com/wagmi-dev/viem/blob/main/src/chains/index.ts
                maxPriorityFeePerGas: 1n,
            },
        },
    },
    aurora: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AURORA_RPC_URL || 'https://mainnet.aurora.dev',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    avax: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AVALANCHE_RPC_URL || 'https://rpc.ankr.com/avalanche',
    },
    base: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base',
    },
    bsc: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
        contracts: {
            ...defaultContracts,
            harvestLens: '0xA2413C80941fcD0EDE877F7fd67eA6e94B971bD3',
        },
        gasConfig: {
            estimateContractGas: {
                // we don't use this gas price after the gas estimation so it's value isn't important
                // but ankr rpc will fail with a "gas is too high!" error when using the default provided by viem (1.5Gwei)
                // watch viemChain.fees for updates: https://github.com/wagmi-dev/viem/blob/main/src/chains/index.ts
                gasPrice: 1n,
            },
        },
        tvl: {
            ...defaultTvLConfig,
            minThresholdUsd: 10_000,
        },
    },
    canto: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CANTO_RPC_URL || 'https://canto.slingshot.finance',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    celo: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CELO_RPC_URL || 'https://rpc.ankr.com/celo',
        eol: true,
    },
    cronos: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CRONOS_RPC_URL || 'https://evm.cronos.org',
    },
    emerald: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.EMERALD_RPC_URL || 'https://emerald.oasis.dev',
        eol: true,
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    ethereum: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth',
    },
    fantom: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.FANTOM_RPC_URL || 'https://rpc.ankr.com/fantom',
    },
    fuse: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.FUSE_RPC_URL || 'https://rpc.fuse.io',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    heco: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.HECO_RPC_URL || 'https://http-mainnet.hecochain.com',
    },
    kava: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.KAVA_RPC_URL || 'https://evm.kava.io',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    metis: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.METIS_RPC_URL || 'https://andromeda.metis.io/?owner=1088',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    moonbeam: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MOONBEAM_RPC_URL || 'https://rpc.testnet.moonbeam.network',
    },
    moonriver: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MOONRIVER_RPC_URL || 'https://rpc.api.moonriver.moonbeam.network',
    },
    one: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ONE_RPC_URL || 'https://rpc.ankr.com/harmony',
        eol: true,
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    optimism: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.OPTIMISM_RPC_URL || 'https://rpc.ankr.com/optimism',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
        contracts: {
            ...defaultContracts,
            harvestLens: '0xEeD0329C9D10dD0D85461203f89a54eD5A7B8418',
        },
        gasConfig: {
            estimateContractGas: {
                // we don't use this gas price after the gas estimation so it's value isn't important
                // but ankr rpc will fail with a "gas is too high!" error when using the default provided by viem (1.5Gwei)
                // watch viemChain.fees for updates: https://github.com/wagmi-dev/viem/blob/main/src/chains/index.ts
                maxPriorityFeePerGas: 1n,
            },
        },
    },
    polygon: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.POLYGON_RPC_URL || 'https://rpc.ankr.com/polygon',
        contracts: {
            ...defaultContracts,
            harvestLens: '0xEeD0329C9D10dD0D85461203f89a54eD5A7B8418',
        },
        transaction: {
            ...defaultTransactionConfig,
            baseFeeMultiplier: 1.7, // polygon is known to stall trx for days when base fee is too low
        },
    },
    zkevm: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ZKEVM_RPC_URL || 'https://rpc.ankr.com/polygon_zkevm',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
    },
    zksync: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ZKSYNC_RPC_URL || 'https://rpc.ankr.com/zksync_era',
        contracts: {
            ...defaultContracts,
            harvestLens: null,
        },
    },
};

type ExplorerConfig = {
    apiUrl: string;
    apiKey: string;
    type: 'etherscan' | 'blockscout';
};
export const EXPLORER_CONFIG: Record<Chain, ExplorerConfig> = {
    arbitrum: {
        apiUrl: 'https://api.arbiscan.io/api',
        apiKey: process.env.ARBITRUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    aurora: {
        apiUrl: 'https://explorer.mainnet.aurora.dev/api',
        apiKey: process.env.AURORA_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    avax: {
        apiUrl: 'https://api.snowtrace.io/api',
        apiKey: process.env.AVAX_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    base: {
        apiUrl: 'https://api.basescan.org/api',
        apiKey: process.env.BASE_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    bsc: {
        apiUrl: 'https://api.bscscan.com/api',
        apiKey: process.env.BSC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    canto: {
        apiUrl: 'https://tuber.build/api',
        apiKey: process.env.CANTO_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    celo: {
        apiUrl: 'https://api.celoscan.io/api/',
        apiKey: process.env.CELO_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    cronos: {
        apiUrl: 'https://cronos.org/explorer/api',
        apiKey: process.env.CRONOS_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    emerald: {
        apiUrl: 'https://explorer.emerald.oasis.doorgod.io/api',
        apiKey: process.env.EMERALD_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    ethereum: {
        apiUrl: 'https://api.etherscan.io/api',
        apiKey: process.env.ETHEREUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fantom: {
        apiUrl: 'https://api.ftmscan.com/api',
        apiKey: process.env.FANTOM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fuse: {
        apiUrl: 'https://explorer.fuse.io/api',
        apiKey: process.env.FUSE_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    heco: {
        apiUrl: 'https://api.hecoinfo.com/api',
        apiKey: process.env.HECO_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    kava: {
        apiUrl: 'https://explorer.kava.io/api',
        apiKey: process.env.KAVA_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    metis: {
        apiUrl: 'https://explorer.metis.io/api',
        apiKey: process.env.METIS_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    moonbeam: {
        apiUrl: 'https://api-moonbeam.moonscan.io/api',
        apiKey: process.env.MOONBEAM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    moonriver: {
        apiUrl: 'https://api-moonriver.moonscan.io/api',
        apiKey: process.env.MOONRIVER_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    one: {
        apiUrl: 'https://ctrver.t.hmny.io/verify',
        apiKey: process.env.ONE_EXPLORER_API_KEY || '',
        type: 'blockscout',
    },
    optimism: {
        apiUrl: 'https://api-optimistic.etherscan.io/api',
        apiKey: process.env.OPTIMISM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    polygon: {
        apiUrl: 'https://api.polygonscan.com/api',
        apiKey: process.env.POLYGON_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zkevm: {
        apiUrl: 'https://api-zkevm.polygonscan.com/api',
        apiKey: process.env.ZKEVM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zksync: {
        apiUrl: 'https://explorer.zksync.io/',
        apiKey: process.env.ZKSYNC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
};
