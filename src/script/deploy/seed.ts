import yargs from 'yargs';
import { runMain } from '../../util/process';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { getReadOnlyRpcClient } from '../../lib/rpc-client';
import { BeefyContractDeployerABI } from '../../abi/BeefyContractDeployerABI';
import { RPC_CONFIG } from '../../util/config';
import { randomInt } from 'crypto';

type CmdOptions = {
    chain: Chain;
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
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain,
    };

    const rpcConfig = RPC_CONFIG[options.chain];
    if (!rpcConfig.contracts.deployer) {
        throw new Error(`No deployer contract address for chain ${options.chain}`);
    }
    const publicClient = getReadOnlyRpcClient({ chain: options.chain });

    const rng = BigInt(randomInt(0, 1000000000));
    const seed = await publicClient.readContract({
        abi: BeefyContractDeployerABI,
        address: rpcConfig.contracts.deployer,
        functionName: 'createSalt',
        args: [rng, rng.toString()],
    });

    console.log(seed);
}

runMain(main);
