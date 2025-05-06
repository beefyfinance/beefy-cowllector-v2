import dotenv from 'dotenv';
import { type Hex, getAddress } from 'viem';
import { bigintMultiplyFloat } from '../util/bigint';
import { allLogLevels } from '../util/logger-type';
import type { LogLevels } from '../util/logger-type';
import { type Chain, allChainIds } from './chain';
import type { RpcConfig } from './rpc-config';
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

export const DATABASE_URL: string = process.env.DATABASE_URL || '';
if (DATABASE_URL === '') {
    throw new Error('Please set DATABASE_URL in your .env file or command line');
}
export const DATABASE_SSL: boolean = process.env.DATABASE_SSL === 'true';

const RPC_FORCE_URL = process.env.RPC_FORCE_URL || null;
const PRIVATE_KEY = (process.env.PRIVATE_KEY || null) as Hex | null;
export const DISABLE_COLLECTOR_FOR_CHAINS: Chain[] = (
    process.env.DISABLE_COLLECTOR_FOR_CHAINS ? process.env.DISABLE_COLLECTOR_FOR_CHAINS.split(',') : []
).filter(chain => allChainIds.includes(chain as Chain)) as Chain[];
export const DISCORD_REPORT_WEBHOOK_URL = process.env.DISCORD_REPORT_WEBHOOK_URL || null;
export const DISCORD_REPORT_ONLY_FOR_CHAINS: Chain[] = ['sonic'];

export const ADD_RP_TVL_TO_CLM_TVL = process.env.ADD_RP_TVL_TO_CLM_TVL === 'true';
export const ADD_RP_VAULT_TVL_TO_CLM_TVL = process.env.ADD_RP_VAULT_TVL_TO_CLM_TVL === 'true';

export const DISCORD_RATE_LIMIT_MIN_SECONDS_BETWEEN_REQUESTS = Number.parseInt(
    process.env.DISCORD_RATE_LIMIT_MIN_SECONDS_BETWEEN_REQUESTS || '10',
    10
);
export const DISCORD_ALERT_WEBHOOK_URL = process.env.DISCORD_ALERT_WEBHOOK_URL || null;
export const DISCORD_NOTIFY_UNEVENTFUL_HARVEST = process.env.DISCORD_NOTIFY_UNEVENTFUL_HARVEST === 'true';
export const DISCORD_PING_ROLE_IDS_ON_ERROR = process.env.DISCORD_PING_ROLE_IDS_ON_ERROR
    ? process.env.DISCORD_PING_ROLE_IDS_ON_ERROR.split(',')
    : [];

// retain all reports for 7 days and daily reports for 30 days
// we need to cleanup reports to avoid breaking heroku's 10k rows limit
export const DB_REPORTS_FULL_RETENTION_IN_DAYS = Number.parseInt(process.env.DB_REPORTS_RETENTION_IN_DAYS || '7', 10);
export const DB_REPORTS_DAILY_RETENTION_IN_DAYS = Number.parseInt(
    process.env.DB_REPORTS_DAILY_RETENTION_IN_DAYS || '30',
    10
);

export const REPORT_URL_TEMPLATE = process.env.REPORT_URL_TEMPLATE || 'https://localhost/report/{{reportId}}';
export const CENSOR_SECRETS_FROM_REPORTS = process.env.CENSOR_SECRETS_FROM_REPORTS
    ? process.env.CENSOR_SECRETS_FROM_REPORTS.split(',')
    : [];

const HARVEST_AT_LEAST_EVERY_HOURS = Number.parseInt(process.env.HARVEST_AT_LEAST_EVERY_HOURS || '23', 10);
const HARVEST_GAS_PRICE_MULTIPLIER = Number.parseFloat(process.env.HARVEST_GAS_PRICE_MULTIPLIER || '1.5');
const HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER = Number.parseFloat(process.env.HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER || '2.5');
const UNWRAP_LIMIT_GAS_AMOUNT_MULTIPLIER = Number.parseFloat(process.env.UNWRAP_LIMIT_GAS_AMOUNT_MULTIPLIER || '1.5');
const REVENUE_BRIDGE_HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER = Number.parseFloat(
    process.env.REVENUE_BRIDGE_HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER || '1.5'
);
const HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER = Number.parseFloat(process.env.HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER || '2');

// some vaults don't get any rewards but are used as colateral by other protocols so we can't retire them
// some stargate vaults are not compatible with the lens since they don't send rewards to the caller immediately
// some vaults can't be paused to allow users to burn their shares (like beefy-beopx)
export const VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS = [
    'aavev3-dai.e',
    'aavev3-polygon-maticx',
    'aavev3-op-dai',
    'aavev3-op-eth',
    'aavev3-op-usdc',
    'aavev3-op-wbtc',
    'curve-arb-f-wsteth',
    'curve-op-f-wsteth',
    'thena-bnbx-wbnb',
    // beefy-be* can't be paused to allow users to burn their shares
    'beefy-beopx',
    'beefy-beqi',

    // gmx vaults are unpredictable when it comes to rewards
    // we don't want to be spammed
    'gmx-arb-link-usdc',
    'gmx-arb-ltc-usdc',
    'gmx-arb-near-usdc',
    'gmx-arb-sol-usdc',
    'gmx-arb-uni-usdc',
    'gmx-arb-usdc-usdt',
    'gmx-arb-wbtc-usdc',
    'gmx-arb-weth-usdc',
    'gmx-arb-xrp-usdc',
    'gmx-arb-aave-usdc',
    'gmx-arb-arb-usdc',
    'gmx-arb-atom-usdc',
    'gmx-arb-bnb-usdc',
    'gmx-arb-doge-usdc',
];

export const VAULT_IDS_WE_KNOW_HAVE_REWARDS_BUT_IS_NOT_TELLING_US = [
    // beefy-bes do not gives rewards to the harvester
    // but if we use VAULT_IDS_THAT_ARE_OK_IF_THERE_IS_NO_REWARDS, it will not give
    // errors when we cannot harvest and silently skip the vault
    'beefy-besonic',
];

// some vaults don't have a harvest(address) function but only a harvest() function
// we need to harvest them with the no params version
export const VAULT_IDS_WE_NEED_TO_HARVEST_NO_PARAMS = ['beefy-besonic'];

// some stargate vaults are not compatible with the lens since they don't send rewards to the caller immediately
// some moon* vaults straight out fail to simulate due to the underlying contract being a native contract
// in both cases we should harvest those vaults blindly every 3 days
export const BLIND_HARVEST_EVERY_X_HOURS = 24 * 3;
export const VAULT_IDS_WE_SHOULD_BLIND_HARVEST = [
    'stargate-base-usdbc',
    'stargate-base-eth',
    'moonwell-xcusdt',
    'solarbeam-wstksm-xcksm',
    'solarbeam-xckbtc-wbtc',
    // these ones have a broken last harvest time on error, it never updates
    // so this is a workaround to make sure we do NOT harvest it every hour
    'vesync-usdc-weth',
    'dracula-usdc-weth',
];

export const SILENCE_NOT_CALM_ERRORS_FOR_HOURS = 24 * 3;

// those platforms are known to be slow to refill rewards so we give them a bit more time before we alert
const oneDayInHours = 24;
export const SLOW_REWARD_WAIT_IN_HOURS: {
    platform: Record<string, number>;
    vault: Record<string, number>;
    strategyTypeId: Record<string, number>;
} = {
    platform: {
        curve: 30 * oneDayInHours,
        balancer: 30 * oneDayInHours,
        convex: 30 * oneDayInHours,
        aura: 30 * oneDayInHours,
        // morpho refill rewards on a weekly basis
        morpho: 8 * oneDayInHours,
    },
    vault: {
        'joe-joe': 30 * oneDayInHours,
        // this specific vault has a weekly refill
        'aavev3-sonic-usdc.e': 8 * oneDayInHours,
    },
    // GMX v2 may not have harvest for up to 7 days
    // The strategy just holds the GM market tokens, waiting for the weekly ARB airdrop.
    // When the ARB is sent the next harvest will swap all ARB to ETH, charge fees, send a
    // small execution fee to GMX, swap half of the ETH to the long token and half to the short,
    // send both to the GMX vault and then submit a deposit request to the GMX keepers.
    // The GMX keepers will take a second and send new GM tokens to the strategy in a new tx
    // and callback the strategy, we sync the balances to say that there is extra GM tokens.
    // The extra GM tokens are recorded as profit and are linearly released over the next 7 days
    // (as the locked profit decays the balanceOf gets larger).
    strategyTypeId: {
        'gmx-gm': 7 * oneDayInHours,
    },
};

// just don't harvest those vaults for now
export const VAULT_IDS_WE_ARE_OK_NOT_HARVESTING: string[] = [];

// some strategies do not have an `harvest(address rewardRecipient)` function that we can call to harvest rewards
// instead, we have to call `harvest()` and then `withdraw(address rewardRecipient)` to get the rewards
// but this call has a different behavior and can send the rewards to trx.origin instead of msg.sender
// for the sake of simplicity, we just don't harvest those vaults and plan to upgrade them since there is only a few of them
export const VAULT_IDS_WITH_MISSING_PROPER_HARVEST_FUNCTION: string[] = [
    'sushi-arb-eth-usdc',
    'sushi-arb-magic-weth',
    'curve-avax-atricrypto',
    'curve-am3crv',
    'curve-op-f-susd',
    'telxchange-quick-aave-tel',
    'nfty-nfty',
    'yel-yel-wbnb',
    'venus-bnb',
];

// 1 ether value in wei
const ONE_ETHER = 1_000_000_000_000_000_000n;
const ONE_GWEI = 1_000_000_000n;

const defaultBatch: RpcConfig['batch'] = {
    jsonRpc: {
        batchSize: 1,
        wait: undefined,
    },
    multicall: {
        batchSize: 4_096,
        wait: 300,
    },
};
const defaultRetry: RpcConfig['retry'] = {
    // these are viem defaults
    maxAttempts: 3,
    exponentialDelayMs: 150,
};
const defaultContracts: RpcConfig['contracts'] = {
    harvestLens: { kind: 'v1', address: getAddress('0x2fD8E72e488d6D2Bc770Cf6F74A5d60E44516aaD') },
    deployer: getAddress('0xcc536552A6214d6667fBC3EC38965F7f556A6391'),
    revenueBridge: getAddress('0x02Ae4716B9D5d48Db1445814b0eDE39f5c28264B'),
};
const defaultAccount: RpcConfig['account'] = {
    privateKey: PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
};
const defaultTransactionConfig: RpcConfig['transaction'] = {
    type: 'eip1559' as const,
    maxGasPricePerTransactionWei: null,
    maxNativePerTransactionWei: null,
    totalTries: 1, // by default, only try the trx once
    retryGasMultiplier: {
        gasPrice: 1.2, // up gas by 20% on each retry
        maxFeePerGas: 1.2, // up gas by 20% on each retry
        maxPriorityFeePerGas: 1.2, // up gas by 20% on each retry
    },
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
    minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
    maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
    setTransactionGasLimit: true,
    balanceCheck: {
        minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: UNWRAP_LIMIT_GAS_AMOUNT_MULTIPLIER,
    },
};
const defaultHarvestConfig: RpcConfig['harvest'] = {
    enabled: true,
    minTvlThresholdUsd: 100,
    minClmTvlThresholdUsd: 100,
    parallelSimulations: 5,
    profitabilityCheck: {
        enabled: false,
        minExpectedRewardsWei: bigintMultiplyFloat(ONE_ETHER, 0.002),
    },
    targetTimeBetweenHarvestsMs: HARVEST_AT_LEAST_EVERY_HOURS * 60 * 60 * 1000,
    setTransactionGasLimit: true,
    balanceCheck: {
        gasLimitMultiplier: HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER,
        gasPriceMultiplier: HARVEST_GAS_PRICE_MULTIPLIER,
        minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost: HARVEST_ENOUGH_GAS_CHECK_MULTIPLIER,
    },
};
const defaultRevenueBridgeHarvestConfig: RpcConfig['revenueBridgeHarvest'] = {
    enabled: true,
    forceGasLimit: null,
    setTransactionGasLimit: true,
    balanceCheck: {
        minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost:
            REVENUE_BRIDGE_HARVEST_LIMIT_GAS_AMOUNT_MULTIPLIER,
    },
};
const defaultAlertingConfig: RpcConfig['alerting'] = {
    networkCongestionWaitInDays: 5,
};

const defaultConfig: RpcConfig = {
    eol: false,
    url: 'changeme',
    retry: defaultRetry,
    harvest: defaultHarvestConfig,
    timeoutMs: defaultTimeoutMs,
    batch: defaultBatch,
    contracts: defaultContracts,
    account: defaultAccount,
    transaction: defaultTransactionConfig,
    unwrap: defaultUnwrapConfig,
    revenueBridgeHarvest: defaultRevenueBridgeHarvestConfig,
    alerting: defaultAlertingConfig,
};

export const RPC_CONFIG: Record<Chain, RpcConfig> = {
    arbitrum: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ARBITRUM_RPC_URL || 'https://rpc.ankr.com/arbitrum',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.05),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            // example of a non bridging trx: https://arbiscan.io/tx/0x6ae25e4910226bbbbac61d4dac16b00f3b9332311238927eab13643459a46573
            // example of a bridging trx: https://arbiscan.io/tx/0xe421daafb3e642913527fe3a9df5ff3f923cad66fe98ab8af52d39a3b46f8166
            forceGasLimit: 2_000_000n,
        },
    },
    aurora: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AURORA_RPC_URL || 'https://mainnet.aurora.dev',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: null,
            maxGasPricePerTransactionWei: null,
        },
        eol: true,
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    avax: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AVAX_RPC_URL || 'https://rpc.ankr.com/avalanche',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            baseFeeMultiplier: 1.5, // avax tend to run into out of gas errors
            receipt: {
                ...defaultTransactionConfig.receipt,
                blockConfirmations: 1, // reduces the amount of TransactionReceiptNotFoundError we get
            },
        },
        harvest: {
            ...defaultHarvestConfig,
            setTransactionGasLimit: false,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.05),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.5),
        },
    },
    base: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        harvest: {
            ...defaultHarvestConfig,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            // example of a bridging transaction: https://basescan.org/tx/0x08992cd1e57a535a747418f813176a6b8a8f9b7dac8892f4889bf094c1a970a0
            // example of a non bridging transaction: https://basescan.org/tx/0x4c06da47f27a0910737c6efe0ca54b493e0ab081effa8caa4641e11d458bff19
            forceGasLimit: 1_500_000n,
        },
        transaction: {
            ...defaultTransactionConfig,
            maxGasPricePerTransactionWei: bigintMultiplyFloat(ONE_GWEI, 0.4),
        },
    },
    berachain: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.BERACHAIN_RPC_URL || 'https://rpc.berachain.com',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'eip1559',
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.5),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.5),
        },
    },
    bsc: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc',
        timeoutMs: 120_000,
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
            maxGasPricePerTransactionWei: bigintMultiplyFloat(ONE_GWEI, 3),
            baseFeeMultiplier: 1.5,
            retryGasMultiplier: {
                gasPrice: 1.5,
                maxFeePerGas: 1.5,
                maxPriorityFeePerGas: 1.5,
            },
        },
        harvest: {
            ...defaultHarvestConfig,
            minTvlThresholdUsd: 10_000,
            minClmTvlThresholdUsd: 1_000,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
                minExpectedRewardsWei: bigintMultiplyFloat(ONE_ETHER, 0.006),
            },
            balanceCheck: {
                ...defaultHarvestConfig.balanceCheck,
                gasPriceMultiplier: 1.5,
                gasLimitMultiplier: 1.5, // try to avoid "gas is too high" errors
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.05),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.1),
        },
    },
    canto: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CANTO_RPC_URL || 'https://canto.slingshot.finance',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 20.0),
            maxGasPricePerTransactionWei: null,
        },
        harvest: {
            ...defaultHarvestConfig,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 10.0),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 60.0),
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
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    cronos: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CRONOS_RPC_URL || 'https://evm.cronos.org',
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 1.5), // 1.5 cro
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 10),
        },
    },
    emerald: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.EMERALD_RPC_URL || 'https://emerald.oasis.dev',
        eol: true,
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: null,
            maxGasPricePerTransactionWei: null,
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    ethereum: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth',
        // ethereum is harvested by gelato
        harvest: {
            ...defaultHarvestConfig,
            enabled: false,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            enabled: false,
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    fantom: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.FANTOM_RPC_URL || 'https://rpc.ankr.com/fantom',
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: ONE_ETHER,
            maxAmountOfNativeWei: ONE_ETHER,
        },
        transaction: {
            ...defaultTransactionConfig,
            receipt: {
                ...defaultTransactionConfig.receipt,
                notFoundErrorRetryCount: 5, // more retries
            },
        },
    },
    fraxtal: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.FRAXTAL_RPC_URL || 'https://rpc.frax.com',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.002),
            maxGasPricePerTransactionWei: null,
            receipt: {
                ...defaultTransactionConfig.receipt,
                notFoundErrorRetryCount: 5, // more retries
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
        },
    },
    fuse: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.FUSE_RPC_URL || 'https://rpc.fuse.io',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 40.0),
            maxGasPricePerTransactionWei: null,
        },
        harvest: {
            ...defaultHarvestConfig,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
            },
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    gnosis: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.GNOSIS_RPC_URL || 'https://rpc.gnosis.io',
        harvest: {
            ...defaultHarvestConfig,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.5),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.5),
        },
    },
    heco: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.HECO_RPC_URL || 'https://http-mainnet.hecochain.com',
        eol: true,
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    kava: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.KAVA_RPC_URL || 'https://evm.kava.io',
        eol: true,
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 3.0),
            maxGasPricePerTransactionWei: null,
        },
        harvest: {
            ...defaultHarvestConfig,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
            },
        },
    },
    linea: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.LINEA_RPC_URL || 'https://rpc.linea.build',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x4FE8b35C2AA9a581aa244c959582d56A3A9da596') },
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            forceGasLimit: 593_200n,
        },
    },
    lisk: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.LISK_RPC_URL || 'https://lisk.drpc.org',
        batch: {
            jsonRpc: false,
            multicall: false, // drpc has low timeout so we avoid using multicall
        },
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'eip1559',
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    manta: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MANTA_RPC_URL || 'https://pacific-rpc.manta.network/http',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'eip1559',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.00005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.0001),
            setTransactionGasLimit: false,
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
            setTransactionGasLimit: false,
            // estimating gas doesn't seem to work well on mantle.
            // we get a lot of "Address: low-level call failed"
            // just set the gas limit to a value matching the previous bridge harvests
            // https://explorer.mantle.xyz/tx/0x7a5988267154abde2faea08b0a7086678a963c7cbce884b4067dfd7086bac5ca
            forceGasLimit: 2_198_429_209n,
        },
    },
    mantle: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MANTLE_RPC_URL || 'https://rpc.mantle.xyz',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0xDe67C516FECC039EA2A303Bf8507d2b05543e316') },
        },
        harvest: {
            ...defaultHarvestConfig,
            setTransactionGasLimit: false,
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'eip1559',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 1),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 10),
            setTransactionGasLimit: false,
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            setTransactionGasLimit: false,
            // estimating gas doesn't seem to work well on mantle.
            // we get a lot of "Address: low-level call failed"
            // just set the gas limit to a value matching the previous bridge harvests
            // https://explorer.mantle.xyz/tx/0x7a5988267154abde2faea08b0a7086678a963c7cbce884b4067dfd7086bac5ca
            forceGasLimit: 2_198_429_209n,
        },
    },
    mode: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MODE_RPC_URL || 'https://mainnet.mode.network',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
        },
        harvest: {
            ...defaultHarvestConfig,
            setTransactionGasLimit: false,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.0005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.0001),
            setTransactionGasLimit: false,
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            setTransactionGasLimit: false,
        },
    },
    metis: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.METIS_RPC_URL || 'https://andromeda.metis.io/?owner=1088',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.17),
            maxGasPricePerTransactionWei: null,
        },
        harvest: {
            ...defaultHarvestConfig,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
            },
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
        url: RPC_FORCE_URL || process.env.MOONBEAM_RPC_URL || 'https://rpc.ankr.com/moonbeam',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        harvest: {
            ...defaultHarvestConfig,
            setTransactionGasLimit: false,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 4.0),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 8.0),
            setTransactionGasLimit: false,
        },
    },
    moonriver: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MOONRIVER_RPC_URL || 'https://moonriver.api.onfinality.io/public',
        // moonriver has tighter rate limiting
        retry: {
            ...defaultRetry,
            exponentialDelayMs: 1000,
        },
        transaction: {
            ...defaultTransactionConfig,
            baseFeeMultiplier: 1.5, // moonriver is known to stall trx for days when base fee is too low
            receipt: {
                ...defaultTransactionConfig.receipt,
                blockConfirmations: 1, // we don't need to wait for 3 confirmations on moonriver
            },
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    one: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ONE_RPC_URL || 'https://rpc.ankr.com/harmony',
        eol: true,
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: null,
            maxGasPricePerTransactionWei: null,
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    optimism: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.OPTIMISM_RPC_URL || 'https://rpc.ankr.com/optimism',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.002),
            maxGasPricePerTransactionWei: null,
            receipt: {
                ...defaultTransactionConfig.receipt,
                notFoundErrorRetryCount: 5, // more retries
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
        },
    },
    polygon: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.POLYGON_RPC_URL || 'https://rpc.ankr.com/polygon',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            baseFeeMultiplier: 1.5, // polygon is known to stall trx for days when base fee is too low
            totalTries: 3, // try 3 times
            receipt: {
                ...defaultTransactionConfig.receipt,
                blockConfirmations: 1, // we don't need to wait for 3 confirmations on polygon
            },
        },
        harvest: {
            ...defaultHarvestConfig,
            profitabilityCheck: {
                ...defaultHarvestConfig.profitabilityCheck,
                enabled: true,
                minExpectedRewardsWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 2.0), // 2 wmatic
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 5.0),
        },
    },
    real: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.REAL_RPC_URL || 'https://real.drpc.org',
        eol: true,
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
        },
        harvest: {
            ...defaultHarvestConfig,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.001),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.002),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: true,
            setTransactionGasLimit: true,
            forceGasLimit: 100_000n,
        },
    },
    rootstock: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ROOTSTOCK_RPC_URL || 'https://public-node.rsk.co',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0xBa63a46D23EBf1859b155999FC4309db5c903F82') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.00025),
        },
        harvest: {
            ...defaultHarvestConfig,
            // 5 days
            targetTimeBetweenHarvestsMs: (5 * 24 - 2) * 60 * 60 * 1000,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.0002),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.0002),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
    scroll: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.SCROLL_RPC_URL || 'https://rpc.scroll.io',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'eip1559',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.01),
            maxGasPricePerTransactionWei: null,
            // try 5 times as the first time we often get a tx failure due to max
            totalTries: 5,
            retryGasMultiplier: {
                gasPrice: 1.2,
                maxFeePerGas: 1.5,
                maxPriorityFeePerGas: 1.3,
            },
        },
        harvest: {
            ...defaultHarvestConfig,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.001),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.001),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: true,
            setTransactionGasLimit: true,
            forceGasLimit: 1_000_000n,
        },
    },
    sei: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.SEI_RPC_URL || 'https://evm-rpc.sei-apis.com',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.4),
        },
        harvest: {
            ...defaultHarvestConfig,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.2),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.2),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: true, // not yet supported
        },
    },
    sonic: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.SONIC_RPC_URL || 'https://rpc.soniclabs.com',
        batch: {
            ...defaultBatch,
            // sonic has some complex logic that consumes a lot of gas
            // so we need to decrease the batch size to avoid out of gas errors
            // it's not clear how to set gas params on sonic simulations as anything
            // seems to crash the simulation, so we just disable multicall batching
            multicall: false,
        },
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v3', address: getAddress('0x1012bA1d39575Db27c8D54A40F8CBb5b5bEb98FD') },
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.05),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 2.0),
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: true,
            setTransactionGasLimit: true,
            forceGasLimit: 1_000_000n,
        },
    },
    unichain: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.UNICHAIN_RPC_URL || 'https://mainnet.unichain.org',
        contracts: {
            ...defaultContracts,
            harvestLens: { kind: 'v2', address: getAddress('0x71e4DF2Bdc7ce0b2dc7CDB9EaC983B251F8A0B58') },
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.002),
            maxGasPricePerTransactionWei: null,
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
        },
    },
    zkevm: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ZKEVM_RPC_URL || 'https://rpc.ankr.com/polygon_zkevm',
        transaction: {
            ...defaultTransactionConfig,
            type: 'legacy',
            maxNativePerTransactionWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxGasPricePerTransactionWei: null,
            receipt: {
                ...defaultTransactionConfig.receipt,
                blockConfirmations: 1, // reduces the amount of TransactionReceiptNotFoundError we get
            },
        },
        unwrap: {
            ...defaultUnwrapConfig,
            minAmountOfWNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.005),
            maxAmountOfNativeWei: bigintMultiplyFloat(ONE_ETHER, 0.02),
        },
        harvest: {
            ...defaultHarvestConfig,
            balanceCheck: {
                ...defaultHarvestConfig.balanceCheck,
                gasPriceMultiplier: 1.1,
            },
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
            // example of a non bridging tx https://zkevm.polygonscan.com/tx/0x0cd5164ce4284b0e4093e64da77ec0aa7ab542b685720a6d515982a12635acde
            // example of a bridging tx https://zkevm.polygonscan.com/tx/0xe0f26db744b242661dfefe5447bc07ff23f7a46a5e06388043c029e94ae8c0d3
            forceGasLimit: 1_000_000n,
        },
    },
    zksync: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ZKSYNC_RPC_URL || 'https://rpc.ankr.com/zksync_era',
        contracts: {
            ...defaultContracts,
            deployer: null,
            harvestLens: { kind: 'v2', address: getAddress('0x80952C4F757FD3A46c80754df7914a417eE37848') },
        },
        revenueBridgeHarvest: {
            ...defaultRevenueBridgeHarvestConfig,
            enabled: false,
        },
    },
};

type ExplorerConfig =
    | {
          addressLinkTemplate: string;
          transactionLinkTemplate: string;
          apiUrl: string;
          apiKey: string;
          type: 'etherscan';
      }
    | {
          addressLinkTemplate: string;
          transactionLinkTemplate: string;
          apiUrl: string;
          type: 'blockscout';
      };
export const EXPLORER_CONFIG: Record<Chain, ExplorerConfig> = {
    arbitrum: {
        addressLinkTemplate: 'https://arbiscan.io/address/${address}',
        transactionLinkTemplate: 'https://arbiscan.io/tx/${hash}',
        apiUrl: process.env.ARBITRUM_EXPLORER_API_URL || 'https://api.arbiscan.io/api',
        apiKey: process.env.ARBITRUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    aurora: {
        addressLinkTemplate: 'https://explorer.mainnet.aurora.dev/address/${address}',
        transactionLinkTemplate: 'https://explorer.mainnet.aurora.dev/tx/${hash}',
        apiUrl: process.env.AURORA_EXPLORER_API_URL || 'https://explorer.mainnet.aurora.dev/api',
        apiKey: process.env.AURORA_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    avax: {
        addressLinkTemplate: 'https://snowtrace.io/address/${address}',
        transactionLinkTemplate: 'https://snowtrace.io/tx/${hash}',
        apiUrl: process.env.AVAX_EXPLORER_API_URL || 'https://api.snowtrace.io/api',
        apiKey: process.env.AVAX_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    base: {
        addressLinkTemplate: 'https://basescan.org/address/${address}',
        transactionLinkTemplate: 'https://basescan.org/tx/${hash}',
        apiUrl: process.env.BASE_EXPLORER_API_URL || 'https://api.basescan.org/api',
        apiKey: process.env.BASE_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    berachain: {
        addressLinkTemplate: 'https://berascan.com/address/${address}',
        transactionLinkTemplate: 'https://berascan.com/tx/${hash}',
        apiUrl: process.env.BERACHAIN_EXPLORER_API_URL || 'https://berascan.com/api?',
        apiKey: process.env.BERACHAIN_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    bsc: {
        addressLinkTemplate: 'https://bscscan.com/address/${address}',
        transactionLinkTemplate: 'https://bscscan.com/tx/${hash}',
        apiUrl: process.env.BSC_EXPLORER_API_URL || 'https://api.bscscan.com/api',
        apiKey: process.env.BSC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    canto: {
        addressLinkTemplate: 'https://tuber.build/address/${address}',
        transactionLinkTemplate: 'https://tuber.build/tx/${hash}',
        apiUrl: process.env.CANTO_EXPLORER_API_URL || 'https://tuber.build/api?',
        type: 'blockscout',
    },
    celo: {
        addressLinkTemplate: 'https://celoscan.io/address/${address}',
        transactionLinkTemplate: 'https://celoscan.io/tx/${hash}',
        apiUrl: process.env.CELO_EXPLORER_API_URL || 'https://api.celoscan.io/api/',
        apiKey: process.env.CELO_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    cronos: {
        addressLinkTemplate: 'https://cronoscan.com/address/${address}',
        transactionLinkTemplate: 'https://cronoscan.com/tx/${hash}',
        apiUrl: process.env.CRONOS_EXPLORER_API_URL || 'https://api.cronoscan.com/api',
        apiKey: process.env.CRONOS_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    emerald: {
        addressLinkTemplate: 'https://explorer.emerald.oasis.dev/address/${address}',
        transactionLinkTemplate: 'https://explorer.emerald.oasis.dev/tx/${hash}',
        apiUrl: process.env.EMERALD_EXPLORER_API_URL || 'https://explorer.emerald.oasis.dev/api?',
        type: 'blockscout',
    },
    ethereum: {
        addressLinkTemplate: 'https://etherscan.io/address/${address}',
        transactionLinkTemplate: 'https://etherscan.io/tx/${hash}',
        apiUrl: process.env.ETHEREUM_EXPLORER_API_URL || 'https://api.etherscan.io/api',
        apiKey: process.env.ETHEREUM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fantom: {
        addressLinkTemplate: 'https://ftmscan.com/address/${address}',
        transactionLinkTemplate: 'https://ftmscan.com/tx/${hash}',
        apiUrl: process.env.FANTOM_EXPLORER_API_URL || 'https://api.ftmscan.com/api',
        apiKey: process.env.FANTOM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fraxtal: {
        addressLinkTemplate: 'https://fraxscan.com/address/${address}',
        transactionLinkTemplate: 'https://fraxscan.com/tx/${hash}',
        apiUrl: process.env.FRAXTAL_EXPLORER_API_URL || 'https://fraxscan.com/api',
        apiKey: process.env.FRAXTAL_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    fuse: {
        addressLinkTemplate: 'https://explorer.fuse.io/address/${address}',
        transactionLinkTemplate: 'https://explorer.fuse.io/tx/${hash}',
        apiUrl: process.env.FUSE_EXPLORER_API_URL || 'https://explorer.fuse.io/api?',
        type: 'blockscout',
    },
    gnosis: {
        addressLinkTemplate: 'https://gnosisscan.io/address/${address}',
        transactionLinkTemplate: 'https://gnosisscan.io/tx/${hash}',
        apiUrl: process.env.GNOSIS_EXPLORER_API_URL || 'https://api.gnosisscan.io/api',
        apiKey: process.env.GNOSIS_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    heco: {
        addressLinkTemplate: 'https://hecoinfo.com/address/${address}',
        transactionLinkTemplate: 'https://hecoinfo.com/tx/${hash}',
        apiUrl: process.env.HECO_EXPLORER_API_URL || 'https://api.hecoinfo.com/api?',
        type: 'blockscout',
    },
    kava: {
        addressLinkTemplate: 'https://kavascan.com/address/${address}',
        transactionLinkTemplate: 'https://kavascan.com/tx/${hash}',
        apiUrl: process.env.KAVA_EXPLORER_API_URL || 'https://kavascan.com/api?',
        type: 'blockscout',
    },
    linea: {
        addressLinkTemplate: 'https://lineascan.build/address/${address}',
        transactionLinkTemplate: 'https://lineascan.build/tx/${hash}',
        apiUrl: process.env.LINEA_EXPLORER_API_URL || 'https://api.lineascan.build/api',
        apiKey: process.env.LINEA_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    lisk: {
        addressLinkTemplate: 'https://blockscout.lisk.com/address/${address}',
        transactionLinkTemplate: 'https://blockscout.lisk.com/tx/${hash}',
        apiUrl: process.env.LISK_EXPLORER_API_URL || 'https://blockscout.lisk.com/api?',
        type: 'blockscout',
    },
    manta: {
        addressLinkTemplate: 'https://pacific-explorer.manta.network/address/${address}',
        transactionLinkTemplate: 'https://pacific-explorer.manta.network//tx/${hash}',
        apiUrl: process.env.MANTA_EXPLORER_API_URL || 'https://pacific-explorer.manta.network/api?',
        type: 'blockscout',
    },
    mantle: {
        addressLinkTemplate: 'https://explorer.mantle.xyz/address/${address}',
        transactionLinkTemplate: 'https://explorer.mantle.xyz/tx/${hash}',
        apiUrl: process.env.MANTLE_EXPLORER_API_URL || 'https://explorer.mantle.xyz/api?',
        type: 'blockscout',
    },
    metis: {
        addressLinkTemplate: 'https://andromeda-explorer.metis.io/address/${address}',
        transactionLinkTemplate: 'https://andromeda-explorer.metis.io/tx/${hash}',
        apiUrl: process.env.METIS_EXPLORER_API_URL || 'https://andromeda-explorer.metis.io/api?',
        type: 'blockscout',
    },
    mode: {
        addressLinkTemplate: 'https://modescan.io//address/${address}',
        transactionLinkTemplate: 'https://modescan.io/tx/${hash}',
        apiUrl: process.env.AVAX_EXPLORER_API_URL || 'https://api.modescan.io/api',
        apiKey: process.env.AVAX_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    moonbeam: {
        addressLinkTemplate: 'https://moonbeam.moonscan.io/address/${address}',
        transactionLinkTemplate: 'https://moonbeam.moonscan.io/tx/${hash}',
        apiUrl: process.env.MOONBEAM_EXPLORER_API_URL || 'https://api-moonbeam.moonscan.io/api',
        apiKey: process.env.MOONBEAM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    moonriver: {
        addressLinkTemplate: 'https://moonriver.moonscan.io/address/address/${address}',
        transactionLinkTemplate: 'https://moonriver.moonscan.io/address/tx/${hash}',
        apiUrl: process.env.MOONRIVER_EXPLORER_API_URL || 'https://api-moonriver.moonscan.io/api',
        apiKey: process.env.MOONRIVER_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    one: {
        addressLinkTemplate: 'https://explorer.harmony.one/address/${address}',
        transactionLinkTemplate: 'https://explorer.harmony.one/tx/${hash}',
        apiUrl: process.env.ONE_EXPLORER_API_URL || 'https://explorer.harmony.one/api?',
        type: 'blockscout',
    },
    optimism: {
        addressLinkTemplate: 'https://optimistic.etherscan.io/address/${address}',
        transactionLinkTemplate: 'https://optimistic.etherscan.io/tx/${hash}',
        apiUrl: process.env.OPTIMISM_EXPLORER_API_URL || 'https://api-optimistic.etherscan.io/api',
        apiKey: process.env.OPTIMISM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    polygon: {
        addressLinkTemplate: 'https://polygonscan.com/address/${address}',
        transactionLinkTemplate: 'https://polygonscan.com/tx/${hash}',
        apiUrl: process.env.POLYGON_EXPLORER_API_URL || 'https://api.polygonscan.com/api',
        apiKey: process.env.POLYGON_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    real: {
        addressLinkTemplate: 'https://explorer.re.al/address/${address}',
        transactionLinkTemplate: 'https://explorer.re.al//tx/${hash}',
        apiUrl: process.env.REAL_EXPLORER_API_URL || 'https://explorer.re.al/api?',
        type: 'blockscout',
    },
    rootstock: {
        addressLinkTemplate: 'https://rootstock.blockscout.com/address/${address}',
        transactionLinkTemplate: 'https://rootstock.blockscout.com/tx/${hash}',
        apiUrl: process.env.ROOTSTOCK_EXPLORER_API_URL || 'https://rootstock.blockscout.com/api?',
        type: 'blockscout',
    },
    scroll: {
        addressLinkTemplate: 'https://scrollscan.com/address/${address}',
        transactionLinkTemplate: 'https://scrollscan.com/tx/${hash}',
        apiUrl: process.env.SCROLL_EXPLORER_API_URL || 'https://api.scrollscan.com/api',
        apiKey: process.env.SCROLL_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    sei: {
        addressLinkTemplate: 'https://seitrace.com/address/${address}',
        transactionLinkTemplate: 'https://seitrace.com/tx/${hash}',
        apiUrl: process.env.SEI_EXPLORER_API_URL || 'https://api.seitrace.com/api',
        apiKey: process.env.SEI_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    sonic: {
        addressLinkTemplate: 'https://sonicscan.org/address/${address}',
        transactionLinkTemplate: 'https://sonicscan.org/tx/${hash}',
        apiUrl: process.env.SONIC_EXPLORER_API_URL || 'https://api.sonicscan.org/api',
        apiKey: process.env.SONIC_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    unichain: {
        addressLinkTemplate: 'https://uniscan.xyz/address/${address}',
        transactionLinkTemplate: 'https://uniscan.xyz/tx/${hash}',
        apiUrl: process.env.UNICHAIN_EXPLORER_API_URL || 'https://api.uniscan.xyz/api',
        apiKey: process.env.UNICHAIN_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zkevm: {
        addressLinkTemplate: 'https://zkevm.polygonscan.com/address/${address}',
        transactionLinkTemplate: 'https://zkevm.polygonscan.com/tx/${hash}',
        apiUrl: process.env.ZKEVM_EXPLORER_API_URL || 'https://api-zkevm.polygonscan.com/api',
        apiKey: process.env.ZKEVM_EXPLORER_API_KEY || '',
        type: 'etherscan',
    },
    zksync: {
        addressLinkTemplate: 'https://explorer.zksync.io/address/${address}',
        transactionLinkTemplate: 'https://explorer.zksync.io/tx/${hash}',
        apiUrl: process.env.ZKSYNC_EXPLORER_API_URL || 'https://explorer.zksync.io/api?',
        type: 'blockscout',
    },
};
