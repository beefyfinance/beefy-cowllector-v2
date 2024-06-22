import { cloneDeep } from 'lodash';
import yargs from 'yargs';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { EXPLORER_CONFIG, RPC_CONFIG } from '../../lib/config';
import { serializeReport } from '../../lib/reports';
import { rootLogger } from '../../util/logger';
import { runMain } from '../../util/process';

const logger = rootLogger.child({ module: 'inspect', component: 'lens' });

type CmdOptions = {
    chains: Chain[];
    obfuscate: boolean;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'array',
            choices: allChainIds,
            alias: 'c',
            demand: true,
            describe: 'Get the config for this chain',
        },
        obfuscate: {
            type: 'boolean',
            demand: false,
            default: true,
            alias: 'o',
            describe: 'Obfuscate sensitive data',
        },
    }).argv;

    const options: CmdOptions = {
        chains: argv.chain as Chain[],
        obfuscate: argv.obfuscate as boolean,
    };
    logger.trace({ msg: 'running with options', data: options });

    const allConfigs = options.chains.map(chain => {
        const chainConfig = cloneDeep({
            chain: chain,
            rpcConfig: RPC_CONFIG[chain],
            explorerConfig: EXPLORER_CONFIG[chain],
        });
        if (options.obfuscate) {
            chainConfig.rpcConfig.account.privateKey = '0x******';
            const rpcUrl = new URL(chainConfig.rpcConfig.url);
            chainConfig.rpcConfig.url = rpcUrl.origin;
            if (chainConfig.explorerConfig.type === 'etherscan') {
                chainConfig.explorerConfig.apiKey = '******';
            }
        }
        return chainConfig;
    });

    console.log(serializeReport(allConfigs, true));
}

runMain(main);
