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
export const UNWRAP_LIMIT_GAS_AMOUNT_MULTIPLIER = parseFloat(process.env.UNWRAP_LIMIT_GAS_AMOUNT_MULTIPLIER || '1.5');
export const HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER = parseFloat(process.env.HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER || '2');

// some vaults don't get any rewards but are used as colateral by other protocols so we can't retire them
export const VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS = process.env.VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS
    ? process.env.VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS.split(',')
    : ['curve-arb-f-wsteth', 'aavev3-dai.e', 'aavev3-polygon-maticx'];

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
    enabled: true,
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
        unwrap: {
            ...defaultUnwrapConfig,
            // celo's native token is also an erc20 contract
            enabled: false,
        },
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
        unwrap: {
            ...defaultUnwrapConfig,
            // https://docs.metis.io/dev/readme/connection-details
            // > NOTICE: Metis is a native token but also an ERC20 compatible token on Layer 2.
            // > It is a built-in feature, so there is no need to create a wrapped Metis token
            enabled: false,
        },
    },
    moonbeam: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MOONBEAM_RPC_URL || 'https://rpc.testnet.moonbeam.network',
    },
    moonriver: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MOONRIVER_RPC_URL || 'https://moonriver.api.onfinality.io/public',
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
            receipt: {
                ...defaultTransactionConfig.receipt,
                blockConfirmations: 1, // reduces the amount of TransactionReceiptNotFoundError we get
            },
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
          addressLinkTemplate: string;
          apiUrl: string;
          apiKey: string;
          type: 'etherscan';
      }
    | {
          addressLinkTemplate: string;
          apiUrl: string;
          type: 'blockscout';
      };
export const EXPLORER_CONFIG: Record<Chain, ExplorerConfig> = {
    arbitrum: {
        addressLinkTemplate: 'https://arbiscan.io/address/${address}',
        apiUrl: process.env.ARBITRUM_EXPLORER_API_URL || 'https://api.arbiscan.io/api',
        apiKey: process.env.ARBITRUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    aurora: {
        addressLinkTemplate: 'https://explorer.mainnet.aurora.dev/address/${address}',
        apiUrl: process.env.AURORA_EXPLORER_API_URL || 'https://explorer.mainnet.aurora.dev/api',
        apiKey: process.env.AURORA_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    avax: {
        addressLinkTemplate: 'https://snowtrace.io/address/${address}',
        apiUrl: process.env.AVAX_EXPLORER_API_URL || 'https://api.snowtrace.io/api',
        apiKey: process.env.AVAX_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    base: {
        addressLinkTemplate: 'https://basescan.org/address/${address}',
        apiUrl: process.env.BASE_EXPLORER_API_URL || 'https://api.basescan.org/api',
        apiKey: process.env.BASE_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    bsc: {
        addressLinkTemplate: 'https://bscscan.com/address/${address}',
        apiUrl: process.env.BSC_EXPLORER_API_URL || 'https://api.bscscan.com/api',
        apiKey: process.env.BSC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    canto: {
        addressLinkTemplate: 'https://tuber.build/address/${address}',
        apiUrl: process.env.CANTO_EXPLORER_API_URL || 'https://tuber.build/api?',
        type: 'blockscout',
    },
    celo: {
        addressLinkTemplate: 'https://celoscan.io/address/${address}',
        apiUrl: process.env.CELO_EXPLORER_API_URL || 'https://api.celoscan.io/api/',
        apiKey: process.env.CELO_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    cronos: {
        addressLinkTemplate: 'https://cronoscan.com/address/${address}',
        apiUrl: process.env.CRONOS_EXPLORER_API_URL || 'https://api.cronoscan.com/api',
        apiKey: process.env.CRONOS_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    emerald: {
        addressLinkTemplate: 'https://explorer.emerald.oasis.dev/address/${address}',
        apiUrl: process.env.EMERALD_EXPLORER_API_URL || 'https://explorer.emerald.oasis.dev/api?',
        type: 'blockscout',
    },
    ethereum: {
        addressLinkTemplate: 'https://etherscan.io/address/${address}',
        apiUrl: process.env.ETHEREUM_EXPLORER_API_URL || 'https://api.etherscan.io/api',
        apiKey: process.env.ETHEREUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fantom: {
        addressLinkTemplate: 'https://ftmscan.com/address/${address}',
        apiUrl: process.env.FANTOM_EXPLORER_API_URL || 'https://api.ftmscan.com/api',
        apiKey: process.env.FANTOM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fuse: {
        addressLinkTemplate: 'https://explorer.fuse.io/address/${address}',
        apiUrl: process.env.FUSE_EXPLORER_API_URL || 'https://explorer.fuse.io/api?',
        type: 'blockscout',
    },
    heco: {
        addressLinkTemplate: 'https://hecoinfo.com/address/${address}',
        apiUrl: process.env.HECO_EXPLORER_API_URL || 'https://api.hecoinfo.com/api?',
        type: 'blockscout',
    },
    kava: {
        addressLinkTemplate: 'https://kavascan.com/address/${address}',
        apiUrl: process.env.KAVA_EXPLORER_API_URL || 'https://kavascan.com/api?',
        type: 'blockscout',
    },
    metis: {
        addressLinkTemplate: 'https://andromeda-explorer.metis.io/address/${address}',
        apiUrl: process.env.METIS_EXPLORER_API_URL || 'https://andromeda-explorer.metis.io/api?',
        type: 'blockscout',
    },
    moonbeam: {
        addressLinkTemplate: 'https://moonbeam.moonscan.io/address/${address}',
        apiUrl: process.env.MOONBEAM_EXPLORER_API_URL || 'https://api-moonbeam.moonscan.io/api',
        apiKey: process.env.MOONBEAM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    moonriver: {
        addressLinkTemplate: 'https://moonriver.moonscan.io/address/address/${address}',
        apiUrl: process.env.MOONRIVER_EXPLORER_API_URL || 'https://api-moonriver.moonscan.io/api',
        apiKey: process.env.MOONRIVER_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    one: {
        addressLinkTemplate: 'https://explorer.harmony.one/address/${address}',
        apiUrl: process.env.ONE_EXPLORER_API_URL || 'https://explorer.harmony.one/api?',
        type: 'blockscout',
    },
    optimism: {
        addressLinkTemplate: 'https://optimistic.etherscan.io/address/${address}',
        apiUrl: process.env.OPTIMISM_EXPLORER_API_URL || 'https://api-optimistic.etherscan.io/api',
        apiKey: process.env.OPTIMISM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    polygon: {
        addressLinkTemplate: 'https://polygonscan.com/address/${address}',
        apiUrl: process.env.POLYGON_EXPLORER_API_URL || 'https://api.polygonscan.com/api',
        apiKey: process.env.POLYGON_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zkevm: {
        addressLinkTemplate: 'https://zkevm.polygonscan.com/address/${address}',
        apiUrl: process.env.ZKEVM_EXPLORER_API_URL || 'https://api-zkevm.polygonscan.com/api',
        apiKey: process.env.ZKEVM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zksync: {
        addressLinkTemplate: 'https://explorer.zksync.io/address/${address}',
        apiUrl: process.env.ZKSYNC_EXPLORER_API_URL || 'https://explorer.zksync.io/api',
        apiKey: process.env.ZKSYNC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
};
