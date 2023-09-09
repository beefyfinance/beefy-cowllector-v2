import { runMain } from '../../util/process';
import { allChainIds } from '../../lib/chain';
import { getVaultsToMonitorByChain } from '../../lib/vault-list';
import yargs from 'yargs';
import { rootLogger } from '../../util/logger';

const logger = rootLogger.child({ module: 'inspect', component: 'api' });

type CmdOptions = {
    hoursSinceLastHarvest: number;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        hoursSinceLastHarvest: {
            type: 'number',
            alias: 'h',
            demand: false,
            default: 26,
            describe: 'Hours since last harvest',
        },
    }).argv;

    const options: CmdOptions = {
        hoursSinceLastHarvest: argv.hoursSinceLastHarvest,
    };
    logger.trace({ msg: 'running with options', data: options });

    const vaults = await getVaultsToMonitorByChain({ chains: allChainIds, strategyAddress: null });

    for (const chain of allChainIds) {
        console.log(chain);
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
