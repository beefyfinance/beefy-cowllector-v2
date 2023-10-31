import { runMain } from '../../util/process';
import { Chain, allChainIds } from '../../lib/chain';
import { getVaultsToMonitorByChain } from '../../lib/vault-list';
import yargs from 'yargs';
import { rootLogger } from '../../util/logger';

const logger = rootLogger.child({ module: 'inspect', component: 'api' });

type CmdOptions = {
    chains: Chain[];
    hoursSinceLastHarvest: number;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'string',
            choices: [...allChainIds, 'all'],
            alias: 'c',
            demand: true,
            default: 'all',
            describe: 'Only show vaults for this chain',
        },
        hoursSinceLastHarvest: {
            type: 'number',
            alias: 'h',
            demand: false,
            default: 26,
            describe: 'Hours since last harvest',
        },
    }).argv;

    const options: CmdOptions = {
        chains: argv.chain === 'all' ? allChainIds : [argv.chain as Chain],
        hoursSinceLastHarvest: argv.hoursSinceLastHarvest,
    };
    logger.trace({ msg: 'running with options', data: options });

    const vaults = await getVaultsToMonitorByChain({ chains: options.chains, strategyAddress: null });

    for (const chain of options.chains) {
        console.log(chain);
        if (!vaults[chain]) {
            continue;
        }
        for (const vault of vaults[chain]) {
            if (vault.eol) {
                continue;
            }

            if (
                vault.lastHarvest &&
                vault.lastHarvest.getTime() + 1000 * 60 * 60 * options.hoursSinceLastHarvest > Date.now()
            ) {
                continue;
            }

            console.log(vault);
        }
    }
}

runMain(main);
