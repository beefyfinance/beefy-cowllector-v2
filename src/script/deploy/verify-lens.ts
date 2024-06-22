import type { Hex } from 'viem';
import yargs from 'yargs';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { verifyFoundryContractForExplorer } from '../../util/foundry';
import { runMain } from '../../util/process';

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
            describe: 'Verify the lens contract on the specified chain',
        },
        lensAddress: {
            type: 'string',
            demand: true,
            alias: 'a',
            describe: 'The lens contract address',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain as Chain,
        lensAddress: argv.lensAddress as Hex,
    };

    await verifyFoundryContractForExplorer({
        chain: options.chain,
        contractAddress: options.lensAddress,
        contractName: 'BeefyHarvestLens',
    });
}

runMain(main);
