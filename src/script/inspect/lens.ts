import { type Hex, getAddress } from 'viem';
import yargs from 'yargs';
import { BeefyHarvestLensV1ABI } from '../../abi/BeefyHarvestLensV1ABI';
import { BeefyHarvestLensV2ABI } from '../../abi/BeefyHarvestLensV2ABI';
import { IStrategyABI } from '../../abi/IStrategyABI';
import { getChainWNativeTokenAddress } from '../../lib/addressbook';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { RPC_CONFIG } from '../../lib/config';
import { getReadOnlyRpcClient, getWalletAccount } from '../../lib/rpc-client';
import { getVault } from '../../lib/vault-list';
import { rootLogger } from '../../util/logger';
import { runMain } from '../../util/process';

const logger = rootLogger.child({ module: 'inspect', component: 'lens' });

type CmdOptions = {
    chain: Chain;
    strategyAddress: Hex;
    blockNumber: bigint | null;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'string',
            choices: allChainIds,
            alias: 'c',
            demand: true,
            describe: 'Run lens for this chain',
        },
        'strategy-address': {
            type: 'string',
            demand: true,
            alias: 'a',
            describe: 'Run lens for this strategy address',
        },
        'block-number': {
            type: 'string',
            demand: false,
            alias: 'b',
            describe: 'Run lens for this block number, default is latest',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain as Chain,
        strategyAddress: argv['strategy-address'] as Hex,
        blockNumber: argv['block-number'] ? BigInt(argv['block-number']) : null,
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

    const harvestLensContract = {
        abi: rpcConfig.contracts.harvestLens.kind === 'v1' ? BeefyHarvestLensV1ABI : BeefyHarvestLensV2ABI,
        address: rpcConfig.contracts.harvestLens.address,
    };
    const strategyContract = {
        abi: IStrategyABI,
        address: vault.strategyAddress,
    };

    const res = await Promise.allSettled([
        publicClient
            .simulateContract({
                ...harvestLensContract,
                functionName: 'harvest',
                args: [getAddress(vault.strategyAddress), getAddress(wnative)],
                account: walletAccount,
                blockNumber: options.blockNumber || undefined,
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
                args: [getAddress(walletAccount.address)],
                account: walletAccount,
                blockNumber: options.blockNumber || undefined,
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
