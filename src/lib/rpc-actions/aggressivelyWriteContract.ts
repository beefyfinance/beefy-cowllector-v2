import {
    type Chain as ViemChain,
    type SimulateContractReturnType,
    type Abi,
    type SimulateContractParameters,
} from 'viem';
import { type AggressivelyWaitForTransactionReceiptReturnType } from './aggressivelyWaitForTransactionReceipt';
import { rootLogger } from '../../util/logger';
import { RpcActionParams } from '../rpc-client';

export type AggressivelyWriteContractParameters<
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends string,
    TChain extends ViemChain | undefined,
    TChainOverride extends ViemChain | undefined,
> = SimulateContractParameters<TAbi, TFunctionName, TChain, TChainOverride>;

// we return the simulation result and the transaction receipt and hash
export type AggressivelyWriteContractReturnType<
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends string,
    TChain extends ViemChain | undefined,
    TChainOverride extends ViemChain | undefined,
> = {
    simulation: SimulateContractReturnType<TAbi, TFunctionName, TChain, TChainOverride>['result'];
    transactionHash: string;
    transactionReceipt: AggressivelyWaitForTransactionReceiptReturnType<TChain>;
};

const logger = rootLogger.child({ module: 'rpc-actions', component: 'aggressivelyWriteContract' });

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
    TAbi extends Abi | readonly unknown[],
    TFunctionName extends string,
    TChain extends ViemChain | undefined,
    TChainOverride extends ViemChain | undefined,
>(
    { publicClient, rpcConfig, walletClient }: RpcActionParams,
    args: AggressivelyWriteContractParameters<TAbi, TFunctionName, TChain, TChainOverride>
): Promise<AggressivelyWriteContractReturnType<TAbi, TFunctionName, TChain, TChainOverride>> {
    const { request, result: simulationResult } = await publicClient.simulateContract(args as any); // TODO: fix typings
    logger.trace({ msg: 'Simulation ok', data: { address: args.address, request } });
    const transactionHash = await walletClient.writeContract(request as any); // TODO: fix typings
    logger.debug({ msg: 'Harvested strat', data: { transactionHash } });

    // wait for the transaction to be mined so we have a proper nonce for the next transaction
    logger.trace({ msg: 'Waiting for transaction receipt', data: { address: args.address, transactionHash } });
    const receipt = await publicClient.aggressivelyWaitForTransactionReceipt({
        hash: transactionHash,
    });
    logger.debug({ msg: 'Got transaction receipt', data: { address: args.address, transactionHash, receipt } });

    return {
        simulation: simulationResult as any, // TODO: fix typings
        transactionHash,
        transactionReceipt: receipt as any, // TODO: fix typings
    };
}
