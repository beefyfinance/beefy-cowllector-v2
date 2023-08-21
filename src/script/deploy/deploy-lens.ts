import yargs from 'yargs';
import { runMain } from '../../util/process';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../../lib/rpc-client';
import { BeefyContractDeployerABI } from '../../abi/BeefyContractDeployerABI';
import { EXPLORER_CONFIG, RPC_CONFIG } from '../../lib/config';
import { getFoundryContractOptimizedBytecode, verifyFoundryContractForExplorer } from '../../util/foundry';
import { Hex } from 'viem';
import { rootLogger } from '../../util/logger';
import { BeefyHarvestLensABI } from '../../abi/BeefyHarvestLensABI';
import { getChainWNativeTokenAddress } from '../../lib/addressbook';

const logger = rootLogger.child({ module: 'deploy-lens' });

type CmdOptions = {
    chain: Chain;
    salt: Hex;
};

async function main() {
    const argv = await yargs
        .usage('$0 <cmd> [args]')
        .options({
            chain: {
                type: 'string',
                choices: allChainIds,
                alias: 'c',
                demand: true,
                describe: 'show wnative token for this chain',
            },
            salt: {
                type: 'string',
                demand: true,
                alias: 's',
                describe: 'The deploy contract salt',
            },
        })
        .check(argv => {
            if (!argv.salt.match(/^0x[0-9a-f]{64}$/i)) {
                throw new Error('Invalid salt, must be a hex string and 32 bytes long');
            }
            return true;
        }).argv;

    const options: CmdOptions = {
        chain: argv.chain,
        salt: argv.salt as Hex,
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

    // build
    const bytecode = await getFoundryContractOptimizedBytecode('BeefyHarvestLens');

    // deploy
    const { request: deployRequest, result: lensAddress } = await publicClient.simulateContract({
        abi: BeefyContractDeployerABI,
        address: rpcConfig.contracts.deployer,
        functionName: 'deploy',
        args: [options.salt, bytecode],
        account: walletAccount,
    });
    const deployTransaction = await walletClient.writeContract(deployRequest);
    logger.info({ msg: 'Lens contract deploy trx', data: { deployTransaction, lensAddress } });
    const deployTrxReceipt = await publicClient.waitForTransactionReceipt({ hash: deployTransaction });
    logger.info({ msg: 'Lens contract deployed at trx', data: { deployTransaction, lensAddress, deployTrxReceipt } });

    // init
    const wnative = getChainWNativeTokenAddress(options.chain);
    const { request: initRequest } = await publicClient.simulateContract({
        abi: BeefyHarvestLensABI,
        address: lensAddress,
        functionName: 'init',
        args: [wnative],
        account: walletAccount,
    });
    const initTransaction = await walletClient.writeContract(initRequest);
    const initTrxReceipt = await publicClient.waitForTransactionReceipt({ hash: initTransaction });
    logger.info({ msg: 'Lens contract initialized', data: { wnative, initTransaction, initTrxReceipt } });

    // verify
    await verifyFoundryContractForExplorer({
        chain: options.chain,
        contractAddress: lensAddress,
        contractName: 'BeefyHarvestLens',
    });
}

runMain(main);
