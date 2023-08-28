import { Account, Chain as ViemChain, Client, Transport, Abi } from 'viem';
import { Chain } from '../chain';
import {
    AggressivelyWaitForTransactionReceiptParameters,
    AggressivelyWaitForTransactionReceiptReturnType,
    aggressivelyWaitForTransactionReceipt,
} from './aggressivelyWaitForTransactionReceipt';
import {
    AggressivelyWriteContractParameters,
    AggressivelyWriteContractReturnType,
    aggressivelyWriteContract,
} from './aggressivelyWriteContract';

type CustomRpcPublicActions<TChain extends ViemChain | undefined = ViemChain | undefined> = {
    aggressivelyWaitForTransactionReceipt: (
        args: AggressivelyWaitForTransactionReceiptParameters
    ) => Promise<AggressivelyWaitForTransactionReceiptReturnType<TChain>>;
};
export function createCustomRpcPublicActions({ chain }: { chain: Chain }) {
    return function customRpcPublicActions<
        TTransport extends Transport = Transport,
        TChain extends ViemChain | undefined = ViemChain | undefined,
        TAccount extends Account | undefined = Account | undefined,
    >(client: Client<TTransport, TChain, TAccount>): CustomRpcPublicActions</*TTransport,*/ TChain /*, TAccount*/> {
        return {
            aggressivelyWaitForTransactionReceipt: args => aggressivelyWaitForTransactionReceipt({ chain }, args),
        };
    };
}

type CustomRpcWalletActions<TChain extends ViemChain | undefined = ViemChain | undefined> = {
    aggressivelyWriteContract: <
        const TAbi extends Abi | readonly unknown[],
        TFunctionName extends string,
        TChainOverride extends ViemChain | undefined,
    >(
        args: AggressivelyWriteContractParameters<TAbi, TFunctionName, TChain, TChainOverride>
    ) => Promise<AggressivelyWriteContractReturnType<TAbi, TFunctionName, TChain, TChainOverride>>;
};

export function createCustomRpcWalletActions({ chain }: { chain: Chain }) {
    return function customRpcWalletActions<
        TTransport extends Transport = Transport,
        TChain extends ViemChain | undefined = ViemChain | undefined,
        TAccount extends Account | undefined = Account | undefined,
    >(_: Client<TTransport, TChain, TAccount>): CustomRpcWalletActions</*TTransport,*/ TChain /*, TAccount*/> {
        return {
            aggressivelyWriteContract: args => aggressivelyWriteContract({ chain }, args),
        };
    };
}
