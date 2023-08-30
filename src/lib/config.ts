import dotenv from 'dotenv';
import { allChainIds, type Chain } from './chain';
import { allLogLevels } from '../util/logger-type';
import type { LogLevels } from '../util/logger-type';
import type { RpcConfig } from './rpc-config';
import { Hex } from 'viem';
import { bigintMultiplyFloat } from '../util/bigint';
dotenv.config();

const timezone = process.env.TZ;
if (timezone !== 'UTC') {
    throw new Error('Please set TZ=UTC in your .env file or command line');
}

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
export const HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER = parseFloat(process.env.HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER || '2');

// 1 ether value in wei
const ONE_ETHER = 1_000_000_000_000_000_000n;

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
    harvestLens: '0x33e6ca0f9CDdE689B742ceaa168de74Ea1f984E8',
    deployer: '0xcc536552A6214d6667fBC3EC38965F7f556A6391',
};
const defaultAccount: RpcConfig['account'] = {
    privateKey: PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
};
const defaultTransactionConfig: RpcConfig['transaction'] = {
    type: 'eip1559' as const,
    totalTries: 1, // by default, only try the trx once
    retryGasMultiplier: 1.2, // up gas by 20% on each retry
    baseFeeMultiplier: 1.25, // 25% above base fee
    receipt: {
        blockConfirmations: 3,
        receiptTimeoutMs: 5 * 60 * 1000,
        notFoundErrorRetryCount: 3,
        notFoundErrorRetryDelayMs: 15 * 1000,
        pollingIntervalMs: 30 * 1000,
    },
};
const defaultTimeoutMs: RpcConfig['timeoutMs'] = 60_000; // high timeout because we batch calls
const defaultUnwrapConfig: RpcConfig['unwrap'] = {
    // default to 0.01 wnative (18 decimals)
    triggerAmountWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
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
    },
    aurora: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AURORA_RPC_URL || 'https://mainnet.aurora.dev',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
        eol: true,
    },
    avax: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AVAX_RPC_URL || 'https://rpc.ankr.com/avalanche',
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
        eol: true,
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
    },
    polygon: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.POLYGON_RPC_URL || 'https://rpc.ankr.com/polygon',
        transaction: {
            ...defaultTransactionConfig,
            baseFeeMultiplier: 1.5, // polygon is known to stall trx for days when base fee is too low
            totalTries: 3, // try 3 times
        },
        unwrap: {
            ...defaultUnwrapConfig,
            triggerAmountWei: bigintMultiplyFloat(ONE_ETHER, 2.0), // 2 wmatic
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

type ExplorerConfig =
    | {
          apiUrl: string;
          apiKey: string;
          type: 'etherscan';
      }
    | {
          apiUrl: string;
          type: 'blockscout';
      };
export const EXPLORER_CONFIG: Record<Chain, ExplorerConfig> = {
    arbitrum: {
        apiUrl: process.env.ARBITRUM_EXPLORER_URL || 'https://api.arbiscan.io/api',
        apiKey: process.env.ARBITRUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    aurora: {
        apiUrl: process.env.AURORA_EXPLORER_URL || 'https://explorer.mainnet.aurora.dev/api',
        apiKey: process.env.AURORA_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    avax: {
        apiUrl: process.env.AVAX_EXPLORER_URL || 'https://api.snowtrace.io/api',
        apiKey: process.env.AVAX_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    base: {
        apiUrl: process.env.BASE_EXPLORER_URL || 'https://api.basescan.org/api',
        apiKey: process.env.BASE_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    bsc: {
        apiUrl: process.env.BSC_EXPLORER_URL || 'https://api.bscscan.com/api',
        apiKey: process.env.BSC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    canto: {
        apiUrl: process.env.CANTO_EXPLORER_URL || 'https://tuber.build/api?',
        type: 'blockscout',
    },
    celo: {
        apiUrl: process.env.CELO_EXPLORER_URL || 'https://api.celoscan.io/api/',
        apiKey: process.env.CELO_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    cronos: {
        apiUrl: process.env.CRONOS_EXPLORER_URL || 'https://cronos.org/explorer/api',
        type: 'blockscout',
    },
    emerald: {
        apiUrl: process.env.EMERALD_EXPLORER_URL || 'https://explorer.emerald.oasis.doorgod.io/api',
        type: 'blockscout',
    },
    ethereum: {
        apiUrl: process.env.ETHEREUM_EXPLORER_URL || 'https://api.etherscan.io/api',
        apiKey: process.env.ETHEREUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fantom: {
        apiUrl: process.env.FANTOM_EXPLORER_URL || 'https://api.ftmscan.com/api',
        apiKey: process.env.FANTOM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fuse: {
        apiUrl: process.env.FUSE_EXPLORER_URL || 'https://explorer.fuse.io/api',
        type: 'blockscout',
    },
    heco: {
        apiUrl: process.env.HECO_EXPLORER_URL || 'https://api.hecoinfo.com/api',
        type: 'blockscout',
    },
    kava: {
        apiUrl: process.env.KAVA_EXPLORER_URL || 'https://kavascan.com/api?',
        type: 'blockscout',
    },
    metis: {
        apiUrl: process.env.METIS_EXPLORER_URL || 'https://explorer.metis.io/api',
        type: 'blockscout',
    },
    moonbeam: {
        apiUrl: process.env.MOONBEAM_EXPLORER_URL || 'https://api-moonbeam.moonscan.io/api',
        apiKey: process.env.MOONBEAM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    moonriver: {
        apiUrl: process.env.MOONRIVER_EXPLORER_URL || 'https://api-moonriver.moonscan.io/api',
        apiKey: process.env.MOONRIVER_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    one: {
        apiUrl: process.env.ONE_EXPLORER_URL || 'https://ctrver.t.hmny.io/verify',
        type: 'blockscout',
    },
    optimism: {
        apiUrl: process.env.OPTIMISM_EXPLORER_URL || 'https://api-optimistic.etherscan.io/api',
        apiKey: process.env.OPTIMISM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    polygon: {
        apiUrl: process.env.POLYGON_EXPLORER_URL || 'https://api.polygonscan.com/api',
        apiKey: process.env.POLYGON_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zkevm: {
        apiUrl: process.env.ZKEVM_EXPLORER_URL || 'https://api-zkevm.polygonscan.com/api',
        apiKey: process.env.ZKEVM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zksync: {
        apiUrl: process.env.ZKSYNC_EXPLORER_URL || 'https://explorer.zksync.io/',
        apiKey: process.env.ZKSYNC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
};
