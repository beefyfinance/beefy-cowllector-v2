import Decimal from 'decimal.js';
import dotenv from 'dotenv';
import type { Chain } from '../types/chain';
import { allLogLevels } from '../types/logger';
import type { LogLevels } from '../types/logger';
import type { RpcConfig } from '../types/rpc';
import { Hex } from 'viem';
dotenv.config();

Decimal.set({
    // make sure we have enough precision
    precision: 50,
    // configure the Decimals lib to format without exponents
    toExpNeg: -250,
    toExpPos: 250,
});

const timezone = process.env.TZ;
if (timezone !== 'UTC') {
    throw new Error('Please set TZ=UTC in your .env file or command line');
}

// sometimes the programmer error dump is too large and interferes with the log buffers
// this messes up the log output. set to true to disable the dump
export const DISABLE_PROGRAMMER_ERROR_DUMP = process.env.DISABLE_PROGRAMMER_ERROR_DUMP === 'true';

export const BEEFY_API_URL = process.env.BEEFY_API_URL || 'https://api.beefy.finance';

const log_level = process.env.LOG_LEVEL || 'info';
if (!allLogLevels.includes(log_level)) {
    throw new Error(`Invalid log level ${log_level}`);
}

export const LOG_LEVEL: LogLevels = log_level as LogLevels;

export const RPC_FORCE_URL = process.env.RPC_FORCE_URL || null;
export const RPC_FORCE_PRIVATE_KEY = (process.env.RPC_FORCE_PRIVATE_KEY || null) as Hex | null;
export const HARVEST_AT_LEAST_EVERY_HOURS = parseInt(process.env.HARVEST_AT_LEAST_EVERY_HOURS || '24', 10);
export const HARVEST_OVERESTIMATE_GAS_BY_PERCENT = parseFloat(process.env.HARVEST_OVERESTIMATE_GAS_BY_PERCENT || '0.5');

const defaultBatch: RpcConfig['batch'] = {
    jsonRpc: {
        batchSize: 1,
        wait: undefined,
    },
    multicall: {
        batchSize: 50,
        wait: 100,
    },
};
const defaultContracts: RpcConfig['contracts'] = {
    harvestLens: '0x2f7bf1B19A9c30C64b13Fd9cD368DdeF24027Ba8',
};
const defaultAccount: RpcConfig['account'] = {
    // TODO: pull from environment variables
    privateKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
};
export const RPC_CONFIG: Record<Chain, RpcConfig> = {
    arbitrum: {
        url: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    aurora: {
        url: process.env.AURORA_RPC_URL || 'https://testnet.aurora.dev',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    avax: {
        url: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    base: {
        url: process.env.BASE_RPC_URL || 'https://api.s0.b.hmny.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    bsc: {
        url: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    canto: {
        url: process.env.CANTO_RPC_URL || 'https://canto-rpc.finance.vote',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    celo: {
        url: process.env.CELO_RPC_URL || 'https://forno.celo.org',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    cronos: {
        url: process.env.CRONOS_RPC_URL || 'https://cronos-testnet.crypto.org:8545',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    emerald: {
        url: process.env.EMERALD_RPC_URL || 'https://ethereum.rpc.emeraldpay.io',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    ethereum: {
        url: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/84842078b09946638c03157f83405213',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    fantom: {
        url: process.env.FANTOM_RPC_URL || 'https://rpcapi.fantom.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    fuse: {
        url: process.env.FUSE_RPC_URL || 'https://rpc.fuse.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    heco: {
        url: process.env.HECO_RPC_URL || 'https://http-mainnet.hecochain.com',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    kava: {
        url: process.env.KAVA_RPC_URL || 'https://rpc.kava.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    metis: {
        url: process.env.METIS_RPC_URL || 'https://api.metis.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    moonbeam: {
        url: process.env.MOONBEAM_RPC_URL || 'https://rpc.testnet.moonbeam.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    moonriver: {
        url: process.env.MOONRIVER_RPC_URL || 'https://rpc.moonriver.moonbeam.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    one: {
        url: process.env.ONE_RPC_URL || 'https://api.s0.t.hmny.io',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    optimism: {
        url: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    polygon: {
        url: process.env.POLYGON_RPC_URL || 'https://rpc-mainnet.maticvigil.com',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    zkevm: {
        url: process.env.ZKEVM_RPC_URL || 'https://zkevm-testnet.iohkdev.io:443',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    zksync: {
        url: process.env.ZKSYNC_RPC_URL || 'https://api.zksync.io/jsrpc',
        eol: false,
        batch: defaultBatch,
        contracts: {
            ...defaultContracts,
            harvestLens: null,
        },
        account: defaultAccount,
    },
};