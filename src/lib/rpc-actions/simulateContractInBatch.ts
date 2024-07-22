import type { Abi, Address } from 'abitype';
import {
    type Account,
    type BaseError,
    type Chain,
    type Client,
    type ContractFunctionArgs,
    type ContractFunctionName,
    type SimulateContractParameters,
    type SimulateContractReturnType,
    type Transport,
    decodeFunctionResult,
    encodeFunctionData,
    getContractError,
} from 'viem';
import { parseAccount } from 'viem/accounts';

/**
 * Fork of viem's `simulateContract` function with a few modifications to accept multicall batching.
 *
 * This would usually hide errors but we are mostly batching calls to a lens that is designed to never
 * throw errors, so we can safely ignore them.
 */
export async function simulateContractInBatch<
    chain extends Chain | undefined,
    account extends Account | undefined,
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
    const args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName>,
    chainOverride extends Chain | undefined = undefined,
    accountOverride extends Account | Address | undefined = undefined,
>(
    client: Client<Transport, chain, account>,
    parameters: SimulateContractParameters<abi, functionName, args, chain, chainOverride, accountOverride>
): Promise<SimulateContractReturnType<abi, functionName, args, chain, account, chainOverride, accountOverride>> {
    const { abi, address, args, dataSuffix, functionName, ...callRequest } = parameters as SimulateContractParameters;

    const account = callRequest.account ? parseAccount(callRequest.account) : client.account;
    const calldata = encodeFunctionData({ abi, args, functionName });
    try {
        // @ts-expect-error
        const { data } = await client.call({
            batch: client.batch,
            data: `${calldata}${dataSuffix ? dataSuffix.replace('0x', '') : ''}`,
            to: address,
            ...callRequest,
            account,
        });
        const result = decodeFunctionResult({
            abi,
            args,
            functionName,
            data: data || '0x',
        });
        const minimizedAbi = abi.filter(abiItem => 'name' in abiItem && abiItem.name === parameters.functionName);
        return {
            result,
            request: {
                abi: minimizedAbi,
                address,
                args,
                dataSuffix,
                functionName,
                ...callRequest,
                account,
            },
        } as unknown as SimulateContractReturnType<
            abi,
            functionName,
            args,
            chain,
            account,
            chainOverride,
            accountOverride
        >;
    } catch (error) {
        throw getContractError(error as BaseError, {
            abi,
            address,
            args,
            docsPath: '/docs/contract/simulateContractInBatch',
            functionName,
            sender: account?.address,
        });
    }
}
