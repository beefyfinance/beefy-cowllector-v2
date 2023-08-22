import yargs from 'yargs';
import { runMain } from '../../util/process';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../../lib/rpc-client';
import { EXPLORER_CONFIG, RPC_CONFIG } from '../../lib/config';
import { verifyFoundryContractForExplorer } from '../../util/foundry';
import { Hex } from 'viem';
import { rootLogger } from '../../util/logger';
import { BeefyHarvestLensABI } from '../../abi/BeefyHarvestLensABI';
import { getChainWNativeTokenAddress } from '../../lib/addressbook';

const logger = rootLogger.child({ module: 'deploy-lens' });

type CmdOptions = {
    chain: Chain;
    lensAddress: Hex;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'string',
            choices: allChainIds,
            alias: 'c',
            demand: true,
            describe: 'show wnative token for this chain',
        },
        lensAddress: {
            type: 'string',
            demand: true,
            alias: 'a',
            describe: 'The lens address',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain,
        lensAddress: argv.lensAddress as Hex,
    };
    const { apiKey: explorerApiKey } = EXPLORER_CONFIG[options.chain];
    if (!explorerApiKey) {
        throw new Error(`No explorer api key for chain ${options.chain}, will not be able to verify contract`);
    }

    const rpcConfig = RPC_CONFIG[options.chain];
    if (!rpcConfig.contracts.deployer) {
        throw new Error(`No deployer contract address for chain ${options.chain}`);
    }
    const publicClient = getReadOnlyRpcClient({ chain: options.chain });
    const walletClient = getWalletClient({ chain: options.chain });
    const walletAccount = getWalletAccount({ chain: options.chain });

    // init
    const wnative = getChainWNativeTokenAddress(options.chain);
    const { request: initRequest } = await publicClient.simulateContract({
        abi: BeefyHarvestLensABI,
        address: options.lensAddress,
        functionName: 'init',
        args: [wnative],
        account: walletAccount,
    });
    const initTransaction = await walletClient.writeContract(initRequest);
    const initTrxReceipt = await publicClient.aggressivelyWaitForTransactionReceipt({ hash: initTransaction });
    logger.info({ msg: 'Lens contract initialized', data: { wnative, initTransaction, initTrxReceipt } });

    // verify
    await verifyFoundryContractForExplorer({
        chain: options.chain,
        contractAddress: options.lensAddress,
        contractName: 'BeefyHarvestLens',
    });
}

runMain(main);
