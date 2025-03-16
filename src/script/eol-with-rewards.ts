import * as fs from 'node:fs';
import { type Hex, getAddress } from 'viem';
import yargs from 'yargs';
import { BeefyHarvestLensV1ABI } from '../abi/BeefyHarvestLensV1ABI';
import { BeefyHarvestLensV2ABI } from '../abi/BeefyHarvestLensV2ABI';
import { getChainWNativeTokenAddress, getChainWNativeTokenDecimals } from '../lib/addressbook';
import { type Chain, allChainIds } from '../lib/chain';
import { RPC_CONFIG } from '../lib/config';
import { type AItem, type AKey, type AVal, reportOnMultipleAsyncCall, serializeReport } from '../lib/reports';
import { getReadOnlyRpcClient } from '../lib/rpc-client';
import type { BeefyVault } from '../lib/vault';
import { getVaultsToMonitorByChain } from '../lib/vault-list';
import type { Async } from '../util/async';
import { rootLogger } from '../util/logger';
import { runMain } from '../util/process';

class JsonFileKVStore<T> {
    private path: string;
    public data: {
        [k: string]: T;
    };

    constructor(path: string) {
        this.path = path;
        this.data = {};
    }

    async load() {
        if (!fs.existsSync(this.path)) {
            return;
        }
        const dataIfExists = await fs.promises.readFile(this.path, {
            encoding: 'utf-8',
        });
        this.data = JSON.parse(dataIfExists);
    }

    async persist() {
        await fs.promises.writeFile(this.path, serializeReport(this.data, true), {
            encoding: 'utf-8',
        });
    }

    get(key: string) {
        return this.data[key];
    }

    set(key: string, data: T) {
        this.data[key] = data;
    }

    has(key: string) {
        return key in this.data;
    }
}

interface EolWithRewardsReportItem {
    vault: BeefyVault;
    simulation: Async<{
        estimatedCallRewardsWei: bigint;
        harvestWillSucceed: boolean;
        lastHarvest: Date;
        hoursSinceLastHarvest: number;
        isLastHarvestRecent: boolean;
        isCalmBeforeHarvest: number;
        paused: boolean;
        blockNumber: bigint;
        harvestResultData: Hex;
        gasUsed: bigint;
    }> | null;
}

const logger = rootLogger.child({ module: 'eol-with-rewards-main' });

type CmdOptions = {
    chain: Chain[];
    storePath: string;
    mode: 'fetch' | 'report-summary';
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'array',
            choices: [...allChainIds, 'all'],
            alias: 'c',
            demand: false,
            default: 'all',
            describe: 'only harest these chains. eol chains will be ignored',
        },
        'store-path': {
            type: 'string',
            alias: 's',
            demand: false,
            default: 'eol-with-rewards.store.json',
            describe: 'path to store the result and restart from in case of crash',
        },
        mode: {
            type: 'string',
            alias: 'm',
            demand: false,
            default: 'fetch',
            choices: ['fetch', 'report-summary'],
            describe: 'fetch the data or report the summary',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
        storePath: argv['store-path'] as string,
        mode: argv.mode as 'fetch' | 'report-summary',
    };
    logger.trace({ msg: 'running with options', data: options });

    const store = new JsonFileKVStore<EolWithRewardsReportItem>(options.storePath);
    await store.load();

    if (options.mode === 'fetch') {
        const vaultsByChain = await getVaultsToMonitorByChain({
            chains: options.chain,
            strategyAddress: null,
        });

        const processPromises = Object.entries(vaultsByChain).map(async ([chain, vaults]) => {
            const rpcConfig = RPC_CONFIG[chain as Chain];
            if (rpcConfig.eol) {
                logger.debug({ msg: 'skipping eol chain', data: { chain } });
                return;
            }
            if (!rpcConfig.harvest.enabled) {
                logger.debug({
                    msg: 'skipping chain with harvest disabled',
                    data: { chain },
                });
                return;
            }

            logger.debug({
                msg: 'processing chain',
                data: { chain, vaults: vaults.length },
            });

            const vaultsToProcess: BeefyVault[] = [];
            for (const vault of vaults) {
                if (!vault.eol) {
                    logger.trace({
                        msg: 'vault is not eol',
                        data: { vaultId: vault.id },
                    });
                    continue;
                }
                if (store.has(vault.id)) {
                    const report = store.get(vault.id);
                    if (report.simulation && report.simulation.status === 'fulfilled') {
                        logger.trace({
                            msg: 'vault already simulated successfully',
                            data: { vaultId: vault.id },
                        });
                        continue;
                    }
                }
                vaultsToProcess.push(vault);
            }

            logger.debug({
                msg: 'processing vaults',
                data: { chain, vaultsToProcessCount: vaultsToProcess.length },
            });

            const result = await fetchLensResult(chain as Chain, vaultsToProcess);

            for (const item of result) {
                store.set(item.vault.id, item);
            }

            await store.persist();
        });

        await Promise.allSettled(processPromises);
    } else if (options.mode === 'report-summary') {
        const summary: {
            chain: Chain;
            vaultId: string;
            status: 'not-simulated' | 'unsuccessful-simulation' | 'no-rewards-found' | 'found-eol-rewards';
            rewards?: string;
        }[] = [];

        for (const [vaultId, item] of Object.entries(store.data)) {
            logger.trace({ msg: 'reporting summary', data: { vaultId } });

            if (item.simulation === null) {
                summary.push({
                    chain: item.vault.chain,
                    vaultId,
                    status: 'not-simulated',
                });
                continue;
            }
            if (item.simulation.status === 'rejected') {
                summary.push({
                    chain: item.vault.chain,
                    vaultId,
                    status: 'unsuccessful-simulation',
                });
                continue;
            }

            const rewards = BigInt(item.simulation.value.estimatedCallRewardsWei);
            if (rewards === 0n) {
                summary.push({
                    chain: item.vault.chain,
                    vaultId,
                    status: 'no-rewards-found',
                });
                continue;
            }

            summary.push({
                chain: item.vault.chain,
                vaultId,
                status: 'found-eol-rewards',
                rewards: rewards.toString(),
            });
        }

        //console.log(JSON.stringify(summary, null, 2));

        const countsByChainAndStatus = summary.reduce(
            (acc, cur) => {
                if (!acc[cur.chain]) {
                    acc[cur.chain] = {};
                }
                if (!acc[cur.chain][cur.status]) {
                    acc[cur.chain][cur.status] = 0;
                }
                acc[cur.chain][cur.status]++;
                return acc;
            },
            {} as { [k: string]: { [k: string]: number } }
        );
        console.log(JSON.stringify(countsByChainAndStatus, null, 2));

        const vaultSummaryByChain = summary.reduce(
            (acc, cur) => {
                if (!acc[cur.chain]) {
                    acc[cur.chain] = [];
                }
                const rewards = BigInt(cur.rewards || '0');
                const wnativeDecimals = getChainWNativeTokenDecimals(cur.chain);
                const divisor = BigInt(`1${'0'.repeat(wnativeDecimals)}`);
                const rewardsEth = `${(rewards / divisor).toString()}.${rewards
                    .toString()
                    .padStart(wnativeDecimals, '0')}`;
                acc[cur.chain].push({ vaultId: cur.vaultId, rewards, rewardsEth });
                return acc;
            },
            {} as {
                [k: string]: { vaultId: string; rewards: bigint; rewardsEth: string }[];
            }
        );

        const top3VaultsByRewardsAndChain = Object.entries(vaultSummaryByChain).reduce(
            (acc, [chain, vaults]) => {
                acc[chain] = vaults.sort((a, b) => (a.rewards > b.rewards ? -1 : 0)).slice(0, 3);
                return acc;
            },
            {} as {
                [k: string]: { vaultId: string; rewards: bigint; rewardsEth: string }[];
            }
        );
        console.log(serializeReport(top3VaultsByRewardsAndChain, true));

        const totalTvlByChain = Object.entries(store.data).reduce(
            (acc, [vaultId, item]) => {
                if (!acc[item.vault.chain]) {
                    acc[item.vault.chain] = 0;
                }
                acc[item.vault.chain] += item.vault.tvlUsd;
                return acc;
            },
            {} as { [k: string]: number }
        );

        totalTvlByChain.__all__ = Object.values(totalTvlByChain).reduce((acc, cur) => acc + cur, 0);
        console.log(JSON.stringify(totalTvlByChain, null, 2));
    }
}

function reportOnMultipleEolRewardsAsyncCall<
    TKey extends AKey<EolWithRewardsReportItem>,
    TItem extends AItem<EolWithRewardsReportItem>,
    TVal extends AVal<EolWithRewardsReportItem, TKey>,
>(...args: Parameters<typeof reportOnMultipleAsyncCall<EolWithRewardsReportItem, TKey, TItem, TVal>>) {
    return reportOnMultipleAsyncCall<EolWithRewardsReportItem, TKey, TItem, TVal>(...args);
}

async function fetchLensResult(chain: Chain, vaults: BeefyVault[]) {
    const wnative = getChainWNativeTokenAddress(chain);
    const publicClient = getReadOnlyRpcClient({ chain });

    // we need the harvest lense
    const rpcConfig = RPC_CONFIG[chain];
    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${chain}`);
    }
    const harvestLensContract = {
        abi: rpcConfig.contracts.harvestLens.kind === 'v1' ? BeefyHarvestLensV1ABI : BeefyHarvestLensV2ABI,
        address: rpcConfig.contracts.harvestLens.address,
    };

    const items = vaults.map(vault => ({
        vault,
        report: { vault, simulation: null } as EolWithRewardsReportItem,
    }));

    await reportOnMultipleEolRewardsAsyncCall(items, 'simulation', { type: 'parallel' }, async item => {
        const { result } = await publicClient.simulateContractInBatch({
            ...harvestLensContract,
            functionName: 'harvest',
            args: [getAddress(item.vault.strategyAddress), getAddress(wnative)] as const,
            //account: walletAccount, // setting the account disables multicall batching
        });

        const now = new Date();
        const lastHarvestDate = new Date(Number(result.lastHarvest) * 1000);
        const timeSinceLastHarvestMs = now.getTime() - lastHarvestDate.getTime();
        const isLastHarvestRecent = timeSinceLastHarvestMs < rpcConfig.harvest.targetTimeBetweenHarvestsMs;
        const isCalmBeforeHarvest = 'isCalmBeforeHarvest' in result ? result.isCalmBeforeHarvest : -1;

        //await new Promise(resolve => setTimeout(resolve, 1000));
        return {
            estimatedCallRewardsWei: result.callReward,
            harvestWillSucceed: result.success,
            lastHarvest: lastHarvestDate,
            hoursSinceLastHarvest: timeSinceLastHarvestMs / 1000 / 60 / 60,
            isLastHarvestRecent,
            isCalmBeforeHarvest,
            paused: result.paused,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed,
            harvestResultData: result.harvestResult,
        };
    });

    return items.map(i => i.report);
}

runMain(main);
