import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/** yargs 18+ requires calling the factory — singleton `yargs.usage()` no longer works */
export function createArgv() {
    return yargs(hideBin(process.argv));
}
