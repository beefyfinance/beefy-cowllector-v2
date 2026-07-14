import type { Hex } from 'viem';
import { getChainWNativeTokenAddress } from '../../lib/addressbook';
import type { Chain } from '../../lib/chain';
import { allChainIds } from '../../lib/chain';
import { fetchCollectorBalance } from '../../lib/collector-balance';
import { rootLogger } from '../../util/logger';
import { runMain } from '../../util/process';
import { createArgv } from '../../util/yargs';

const logger = rootLogger.child({ module: 'inspect', component: 'balance' });
type CmdOptions = {
    chain: Chain;
    collectorAddress: Hex;
    blockNumber: bigint | null;
};

async function main() {
    const argv = await createArgv()
        .usage('$0 <cmd> [args]')
        .options({
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
            ...res.map((r) => {
                if (r.status === 'rejected') {
                    r.reason.abi = 'redacted';
                }
                return r;
            }),
        ],
        { depth: null }
    );
}

runMain(main);
