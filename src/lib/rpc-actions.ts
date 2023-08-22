import {
    Account,
    Chain as ViemChain,
    Client,
    Transport,
    WaitForTransactionReceiptParameters,
    WaitForTransactionReceiptReturnType,
    BlockNotFoundError,
} from 'viem';
import { Chain } from './chain';
import { rootLogger } from '../util/logger';
import { getReadOnlyRpcClient } from './rpc-client';
import { withRetry } from '../util/promise';

const logger = rootLogger.child({ module: 'rpc-actions' });

function aggressivelyWaitForTransactionReceipt<TChain extends ViemChain | undefined>(
    chain: Chain,
    args: WaitForTransactionReceiptParameters<TChain>
): Promise<WaitForTransactionReceiptReturnType<TChain>> {
    // use our own clients since it's a bit of a pain to import the individual viem actions
    const publicClient = getReadOnlyRpcClient({ chain });

    return withRetry(
        (): Promise<WaitForTransactionReceiptReturnType<TChain>> => {
            // couldn't find a way to properly type this, feel free to fix
            return publicClient.waitForTransactionReceipt(args as any) as any as Promise<
                WaitForTransactionReceiptReturnType<TChain>
            >;
        },
        {
            // do not retry too much since waitForTransactionReceipt is already retrying a bunch
            retryCount: 5,
            delay: 1000,
            shouldRetry: err => {
                // we want to retry on BlockNotFoundError
                // this happens when we use an rpc cluster with many nodes and we hit one that is lagging behind
                // happens a lot with ankr's rpc cluster
                if (err instanceof BlockNotFoundError) {
                    logger.warn({ msg: 'waitForTransactionReceipt: block not found, retrying', data: { err } });
                    return true;
                }

                return false;
            },
        }
    );
}

type CustomRpcActions<
    //TTransport extends Transport = Transport,
    TChain extends ViemChain | undefined = ViemChain | undefined,
    //TAccount extends Account | undefined = Account | undefined,
> = {
    aggressivelyWaitForTransactionReceipt: (
        args: WaitForTransactionReceiptParameters<TChain>
    ) => Promise<WaitForTransactionReceiptReturnType<TChain>>;
};

export function createCustomRpcActions({ chain }: { chain: Chain }) {
    return function customRpcActions<
        TTransport extends Transport = Transport,
        TChain extends ViemChain | undefined = ViemChain | undefined,
        TAccount extends Account | undefined = Account | undefined,
    >(_: Client<TTransport, TChain, TAccount>): CustomRpcActions</*TTransport,*/ TChain /*, TAccount*/> {
        return {
            aggressivelyWaitForTransactionReceipt: args => aggressivelyWaitForTransactionReceipt(chain, args),
        };
    };
}
