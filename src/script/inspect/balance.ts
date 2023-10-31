import yargs from 'yargs';
import { runMain } from '../../util/process';
import { allChainIds } from '../../lib/chain';
import type { Chain } from '../../lib/chain';
import { rootLogger } from '../../util/logger';
import { Hex } from 'viem';
import { fetchCollectorBalance } from '../../lib/collector-balance';
import { getChainWNativeTokenAddress } from '../../lib/addressbook';
import { getWalletAccount } from '../../lib/rpc-client';

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

    const walletAccount = getWalletAccount({ chain: options.chain });
    // override the wallet account with the address provided
    walletAccount.address = options.collectorAddress;
    const res = await Promise.allSettled([fetchCollectorBalance({ chain: options.chain })]);

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
