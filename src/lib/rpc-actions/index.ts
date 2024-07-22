import type {
    Abi,
    Account,
    Address,
    Client,
    ContractFunctionArgs,
    ContractFunctionName,
    DeriveChain,
    ExtractAbiFunctionForArgs,
    ParseAccount,
    SimulateContractParameters,
    SimulateContractReturnType,
    Transport,
    Chain as ViemChain,
} from 'viem';
import type { Chain } from '../chain';
import {
    type AggressivelyWaitForTransactionReceiptParameters,
    type AggressivelyWaitForTransactionReceiptReturnType,
    aggressivelyWaitForTransactionReceipt,
} from './aggressivelyWaitForTransactionReceipt';
import {
    type AggressivelyWriteContractParameters,
    type AggressivelyWriteContractReturnType,
    aggressivelyWriteContract,
} from './aggressivelyWriteContract';
import { simulateContractInBatch } from './simulateContractInBatch';

type CustomRpcPublicActions<
    TChain extends ViemChain | undefined = ViemChain | undefined,
    TAccount extends Account | undefined = Account | undefined,
> = {
    aggressivelyWaitForTransactionReceipt: (
        args: AggressivelyWaitForTransactionReceiptParameters
    ) => Promise<AggressivelyWaitForTransactionReceiptReturnType<TChain>>;

    simulateContractInBatch: <
        const abi extends Abi | readonly unknown[],
        functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
        args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>,
        chainOverride extends ViemChain | undefined,
        accountOverride extends Account | Address | undefined = undefined,
    >(
        args: SimulateContractParameters<abi, functionName, args, TChain, chainOverride, accountOverride>
    ) => Promise<SimulateContractReturnType<abi, functionName, args, TChain, TAccount, chainOverride, accountOverride>>;
};
export function createCustomRpcPublicActions({ chain }: { chain: Chain }) {
    return function customRpcPublicActions<
        TTransport extends Transport = Transport,
        TChain extends ViemChain | undefined = ViemChain | undefined,
        TAccount extends Account | undefined = Account | undefined,
    >(client: Client<TTransport, TChain, TAccount>): CustomRpcPublicActions</*TTransport,*/ TChain /*, TAccount*/> {
        return {
            aggressivelyWaitForTransactionReceipt: args => aggressivelyWaitForTransactionReceipt({ chain }, args),
            simulateContractInBatch: args => simulateContractInBatch(client, args),
        };
    };
}

type CustomRpcWalletActions<TChain extends ViemChain | undefined = ViemChain | undefined> = {
    aggressivelyWriteContract: <
        abi extends Abi | readonly unknown[] = Abi,
        functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'> = ContractFunctionName<
            abi,
            'nonpayable' | 'payable'
        >,
        args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName> = ContractFunctionArgs<
            abi,
            'nonpayable' | 'payable',
            functionName
        >,
        chain extends ViemChain | undefined = ViemChain | undefined,
        account extends Account | undefined = Account | undefined,
        chainOverride extends ViemChain | undefined = ViemChain | undefined,
        accountOverride extends Account | Address | undefined = Account | Address | undefined,
        ///
        derivedChain extends ViemChain | undefined = DeriveChain<chain, chainOverride>,
        minimizedAbi extends Abi = readonly [
            ExtractAbiFunctionForArgs<abi extends Abi ? abi : Abi, 'nonpayable' | 'payable', functionName, args>,
        ],
        resolvedAccount extends Account | undefined = accountOverride extends Account | Address
            ? ParseAccount<accountOverride>
            : account,
    >(
        args: AggressivelyWriteContractParameters<
            abi,
            functionName,
            args,
            chain,
            chainOverride,
            accountOverride,
            derivedChain
        >
    ) => Promise<
        AggressivelyWriteContractReturnType<
            abi,
            functionName,
            args,
            chain,
            account,
            chainOverride,
            accountOverride,
            minimizedAbi,
            resolvedAccount
        >
    >;
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
