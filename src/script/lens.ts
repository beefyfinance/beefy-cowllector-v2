import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../lib/chain';
import type { Chain } from '../lib/chain';
import { rootLogger } from '../util/logger';
import { getVault } from '../lib/vault-list';
import { Hex } from 'viem';
import { RPC_CONFIG } from '../lib/config';
import { getReadOnlyRpcClient, getWalletAccount } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { getChainWNativeTokenAddress } from '../lib/addressbook';
import { IStrategyABI } from '../abi/IStrategyABI';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain;
    strategyAddress: Hex;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'string',
            choices: [...allChainIds],
            alias: 'c',
            demand: true,
            describe: 'only harest these chains. eol chains will be ignored',
        },
        'strategy-address': {
            type: 'string',
            demand: true,
            alias: 'a',
            describe: 'only harvest for this strategy address',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain as Chain,
        strategyAddress: argv['strategy-address'] as Hex,
    };
    logger.trace({ msg: 'running with options', data: options });

    // fetch vaults from beefy api
    const vault = await getVault({
        chain: options.chain,
        strategyAddress: options.strategyAddress,
    });
    if (!vault) {
        throw new Error(`Vault not found for chain ${options.chain} and contract address ${options.strategyAddress}`);
    }

    const publicClient = getReadOnlyRpcClient({ chain: options.chain });
    const walletAccount = getWalletAccount({ chain: options.chain });
    const wnative = getChainWNativeTokenAddress(options.chain);
    const rpcConfig = RPC_CONFIG[options.chain];

    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${options.chain}`);
    }

    const harvestLensContract = { abi: BeefyHarvestLensABI, address: rpcConfig.contracts.harvestLens };
    const strategyContract = { abi: IStrategyABI, address: vault.strategyAddress };

    const res = await Promise.allSettled([
        publicClient
            .simulateContract({
                ...harvestLensContract,
                functionName: 'harvest',
                args: [vault.strategyAddress, wnative],
                account: walletAccount,
            })
            .then(res => {
                // @ts-ignore
                res.request.abi = 'BeefyHarvestLensABI';
                // @ts-ignore
                res.request.account = walletAccount.address;
                return res;
            }),
        publicClient
            .simulateContract({
                ...strategyContract,
                functionName: 'harvest',
                args: [walletAccount.address],
                account: walletAccount,
            })
            .then(res => {
                // @ts-ignore
                res.request.abi = 'IStrategyABI';
                // @ts-ignore
                res.request.account = walletAccount.address;
                return res;
            }),
    ]);

    console.dir(
        res.map(r => {
            if (r.status === 'rejected') {
                // @ts-ignore
                r.reason.abi = 'redacted';
            }
            return r;
        }),
        { depth: null }
    );
}

runMain(main);
