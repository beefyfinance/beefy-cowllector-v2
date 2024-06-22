import type { Hex } from 'viem';
import yargs from 'yargs';
import { BeefyContractDeployerABI } from '../../abi/BeefyContractDeployerABI';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { EXPLORER_CONFIG, LENS_DEPLOY_GAS_MULTIPLIER, RPC_CONFIG } from '../../lib/config';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../../lib/rpc-client';
import { bigintMultiplyFloat } from '../../util/bigint';
import { getFoundryContractOptimizedBytecode, verifyFoundryContractForExplorer } from '../../util/foundry';
import { rootLogger } from '../../util/logger';
import { runMain } from '../../util/process';

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
                describe: 'deploy the lens contract on the specified chain',
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
        chain: argv.chain as Chain,
        salt: argv.salt as Hex,
    };

    logger.info({ msg: 'Deploying lens contract', data: { options } });

    logger.debug({ msg: 'Building lens contract' });
    const bytecode = await getFoundryContractOptimizedBytecode('BeefyHarvestLens');
    const { chain, salt } = options;

    const explorerConfig = EXPLORER_CONFIG[chain];
    if (explorerConfig.type === 'etherscan' && !explorerConfig.apiKey) {
        throw new Error(`No explorer api key for chain ${chain}, will not be able to verify contract`);
    }
    if (explorerConfig.type === 'blockscout' && !explorerConfig.apiUrl.endsWith('/api?')) {
        throw new Error(`Invalid explorer api url for chain ${chain}, must end with "/api?"`);
    }

    const rpcConfig = RPC_CONFIG[chain];
    if (!rpcConfig.contracts.deployer) {
        throw new Error(`No deployer contract address for chain ${chain}`);
    }
    const publicClient = getReadOnlyRpcClient({ chain: chain });
    const walletClient = getWalletClient({ chain: chain });
    const walletAccount = getWalletAccount({ chain: chain });

    logger.info({
        msg: 'Deploying lens contract',
        data: { chain, salt, bytecode },
    });
    const { request: deployRequest, result: lensAddress } = await publicClient.simulateContract({
        abi: BeefyContractDeployerABI,
        address: rpcConfig.contracts.deployer,
        functionName: 'deploy',
        args: [salt, bytecode],
        account: walletAccount,
    });
    console.dir({ deployRequest, lensAddress }, { depth: null });
    if (deployRequest.gas) {
        deployRequest.gas = bigintMultiplyFloat(deployRequest.gas, LENS_DEPLOY_GAS_MULTIPLIER);
    }
    const deployTransaction = await walletClient.writeContract(deployRequest);
    logger.info({
        msg: 'Lens contract deploy trx',
        data: { deployTransaction, lensAddress },
    });
    const deployTrxReceipt = await publicClient.aggressivelyWaitForTransactionReceipt({
        hash: deployTransaction,
    });
    logger.info({
        msg: 'Lens contract deployed at trx',
        data: { deployTransaction, lensAddress, deployTrxReceipt },
    });

    logger.debug({
        msg: 'Verifying lens contract',
        data: { chain, lensAddress },
    });
    await verifyFoundryContractForExplorer({
        chain: chain,
        contractAddress: lensAddress,
        contractName: 'BeefyHarvestLens',
    });
    logger.info({ msg: 'Lens contract verified', data: { chain, lensAddress } });
}

runMain(main);
