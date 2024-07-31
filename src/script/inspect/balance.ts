import type { Hex } from 'viem';
import yargs from 'yargs';
import { getChainWNativeTokenAddress } from '../../lib/addressbook';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { fetchCollectorBalance } from '../../lib/collector-balance';
import { rootLogger } from '../../util/logger';
import { runMain } from '../../util/process';

const logger = rootLogger.child({ module: 'inspect', component: 'balance' });
type CmdOptions = {
    chain: Chain;
    collectorAddress: Hex;
    blockNumber: bigint | null;
};

async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'string',
            choices: allChainIds,
            alias: 'c',
            demand: true,
            describe: 'Get the balances on this chain',
        },
        'collector-address': {
            type: 'string',
            demand: true,
            alias: 'a',
            describe: 'Get the balances for this collector balance',
        },
        'block-number': {
            type: 'string',
            demand: false,
            alias: 'b',
            describe: 'Get the balances for this block number, default is latest',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain as Chain,
        collectorAddress: argv['collector-address'] as Hex,
        blockNumber: argv['block-number'] ? BigInt(argv['block-number']) : null,
    };
    logger.trace({ msg: 'running with options', data: options });

    const res = await Promise.allSettled([
        fetchCollectorBalance({
            chain: options.chain,
            overwriteCowllectorAddress: options.collectorAddress,
        }),
    ]);

    console.dir(
        [
            getChainWNativeTokenAddress(options.chain),
            ...res.map(r => {
                if (r.status === 'rejected') {
                    // @ts-ignore
                    r.reason.abi = 'redacted';
                }
                return r;
            }),
        ],
        { depth: null }
    );
}

runMain(main);
