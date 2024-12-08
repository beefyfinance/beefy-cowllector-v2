import { cloneDeep } from 'lodash';
import type {
    Abi,
    Account,
    Address,
    ContractFunctionArgs,
    ContractFunctionName,
    DeriveChain,
    ExtractAbiFunctionForArgs,
    Hex,
    ParseAccount,
    SimulateContractParameters,
    SimulateContractReturnType,
    TransactionReceipt,
    Chain as ViemChain,
} from 'viem';
import { bigintMultiplyFloat } from '../../util/bigint';
import { rootLogger } from '../../util/logger';
import type { Chain } from '../chain';
import { getRpcActionParams } from '../rpc-client';
import type { AggressivelyWaitForTransactionReceiptReturnType } from './aggressivelyWaitForTransactionReceipt';

export type AggressivelyWriteContractParameters<
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
    chainOverride extends ViemChain | undefined = ViemChain | undefined,
    accountOverride extends Account | Address | undefined = undefined,
    ///
    derivedChain extends ViemChain | undefined = DeriveChain<chain, chainOverride>,
> = SimulateContractParameters<abi, functionName, args, chain, chainOverride, accountOverride, derivedChain>;

// we return the simulation result and the transaction receipt and hash
export type AggressivelyWriteContractReturnType<
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
    minimizedAbi extends Abi = readonly [
        ExtractAbiFunctionForArgs<abi extends Abi ? abi : Abi, 'nonpayable' | 'payable', functionName, args>,
    ],
    resolvedAccount extends Account | undefined = accountOverride extends Account | Address
        ? ParseAccount<accountOverride>
        : account,
> = {
    simulation: SimulateContractReturnType<
        abi,
        functionName,
        args,
        chain,
        account,
        chainOverride,
        accountOverride,
        minimizedAbi,
        resolvedAccount
    >['result'];
    transactionHash: Hex;
    transactionReceipt: AggressivelyWaitForTransactionReceiptReturnType<ViemChain>;
};

const logger = rootLogger.child({
    module: 'rpc-actions',
    component: 'aggressivelyWriteContract',
});

/**
 * How this method works:
 * - send a transaction Tx1 with nonce N and gasPrice Gp1
 * - await for Tx1 to be minted for T time.
 * - After T, if Tx1 was not minted, submit Tx2 with nonce N (same) and price = Gp2, where Gp2 = Gp1 * mult (mult > 1)
 * - await for Tx1 or Tx2 to be minted for T time.
 * - After T, if nothing was not minted, submit Tx2 with nonce N (same) and price = Gp3, where Gp3 = Gp2 * mult
 * - await for Tx1, Tx2 or Tx3 to be minted for T time.
 * ... repeat R times until something go through or we hit the max number of retries.
 */
export async function aggressivelyWriteContract<
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
    { chain }: { chain: Chain },
    args: AggressivelyWriteContractParameters<
        abi,
        functionName,
        args,
        chain,
        chainOverride,
        accountOverride,
        derivedChain
    >
): Promise<
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
> {
    const { publicClient, walletClient, walletAccount, rpcConfig } = getRpcActionParams({ chain });
    const nonce = await publicClient.getTransactionCount({
        address: walletAccount.address,
        blockTag: 'pending',
    });
    logger.debug({
        msg: 'Got nonce',
        data: { chain, address: args.address, nonce },
    });

    const gasParams = await publicClient.estimateFeesPerGas({
        type: rpcConfig.transaction.type,
    });
    logger.debug({
        msg: 'Got gas params',
        data: { chain, address: args.address, gasParams },
    });
    if (gasParams.maxFeePerGas === 0n) {
        gasParams.maxFeePerGas = 1n;
    }
    if (gasParams.maxPriorityFeePerGas === 0n) {
        if (gasParams.maxFeePerGas) {
            gasParams.maxPriorityFeePerGas = gasParams.maxFeePerGas;
        } else {
            gasParams.maxPriorityFeePerGas = 1n;
        }
    }
    if (gasParams.gasPrice === 0n) {
        gasParams.gasPrice = 1n;
    }

    const allPendingTransactions: Hex[] = [];

    const mint = async () => {
        const { request, result: simulationResult } = await publicClient.simulateContract({
            nonce,
            ...gasParams,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            ...(args as any), // TODO: fix typings
        });
        logger.trace({
            msg: 'Simulation ok',
            data: { chain, address: args.address, request },
        });
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        const transactionHash = await walletClient.writeContract(request as any); // TODO: fix typings
        logger.debug({ msg: 'Transaction ok', data: { chain, transactionHash } });
        allPendingTransactions.push(transactionHash);
        // wait for the transaction to be mined so we have a proper nonce for the next transaction
        logger.trace({
            msg: 'Waiting for transaction receipts',
            data: { chain, address: args.address, allPendingTransactions },
        });

        let receipt: TransactionReceipt;
        try {
            receipt = await Promise.any(
                allPendingTransactions.map(hash => publicClient.aggressivelyWaitForTransactionReceipt({ hash }))
            );
        } catch (err) {
            if (err instanceof AggregateError) {
                throw err.errors[err.errors.length - 1];
            }
            throw err;
        }
        logger.debug({
            msg: 'Got transaction receipt',
            data: { chain, address: args.address, transactionHash, receipt },
        });

        return {
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            simulation: simulationResult as any, // TODO: fix typings
            transactionHash: receipt.transactionHash,
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            transactionReceipt: receipt as any, // TODO: fix typings
        };
    };

    for (let i = 0; i < rpcConfig.transaction.totalTries; i++) {
        try {
            logger.trace({
                msg: 'Trying to mint',
                data: { chain, address: args.address, try: i, gasParams },
            });
            return await mint();
        } catch (err) {
            if (i < rpcConfig.transaction.totalTries - 1) {
                // increase the gas price for the next transaction
                const previousGasParams = cloneDeep(gasParams);
                if (gasParams.gasPrice) {
                    gasParams.gasPrice = bigintMultiplyFloat(
                        gasParams.gasPrice || 1n,
                        rpcConfig.transaction.retryGasMultiplier.gasPrice
                    );
                }
                if (gasParams.maxPriorityFeePerGas) {
                    gasParams.maxPriorityFeePerGas = bigintMultiplyFloat(
                        gasParams.maxPriorityFeePerGas || 1n,
                        rpcConfig.transaction.retryGasMultiplier.maxPriorityFeePerGas
                    );
                }
                if (gasParams.maxFeePerGas) {
                    gasParams.maxFeePerGas = bigintMultiplyFloat(
                        gasParams.maxFeePerGas || 1n,
                        rpcConfig.transaction.retryGasMultiplier.maxFeePerGas
                    );
                }
                logger.warn({
                    msg: 'minting failed, retrying',
                    data: {
                        chain,
                        address: args.address,
                        previousGasParams,
                        nextGasParams: gasParams,
                    },
                });
            } else {
                logger.warn({
                    msg: 'Minting failed, exiting',
                    data: { chain, address: args.address, err },
                });
                throw err;
            }
        }
    }
    throw new Error('Should not happen');
}
