import { Account, Chain as ViemChain, Client, Transport, Hex } from 'viem';
import { Chain } from './chain';
import { rootLogger } from '../util/logger';
import { IStrategyABI } from '../abi/IStrategyABI';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from './rpc-client';
import { RPC_CONFIG } from './config';
import { NotEnoughRemainingGasError } from './harvest-errors';

const logger = rootLogger.child({ module: 'harvest-actions' });

type HarvestParameters = {
    strategyAddress: Hex;
    transactionCostEstimationWei: bigint;
};

type HarvestReturnType = {
    transactionHash: Hex;
    blockNumber: bigint;
    gasUsed: bigint;
    effectiveGasPrice: bigint;
    balanceBeforeWei: bigint;
};

async function harvest<TChain extends ViemChain | undefined>(
    client: Client<Transport, TChain>,
    chain: Chain,
    { strategyAddress, transactionCostEstimationWei }: HarvestParameters
): Promise<HarvestReturnType> {
    // use our own clients since it's a bit of a pain to import the individual viem actions
    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    // check if we have enough gas to harvest
    logger.trace({ msg: 'Checking gas', data: { chain, strategyAddress } });
    const balanceBeforeWei = await publicClient.getBalance({ address: walletAccount.address });
    if (balanceBeforeWei < transactionCostEstimationWei) {
        logger.info({ msg: 'Not enough gas to harvest', data: { chain, balanceBeforeWei, strategyAddress } });
        const error = new NotEnoughRemainingGasError({
            chain,
            remainingGasWei: balanceBeforeWei,
            transactionCostEstimationWei,
            strategyAddress,
        });
        throw error;
    }
    logger.debug({ msg: 'Enough gas to harvest', data: { chain, balanceBeforeWei, strategyAddress } });

    // harvest the strat
    // no need to set gas fees as viem has automatic EIP-1559 detection and gas settings
    // https://github.com/wagmi-dev/viem/blob/viem%401.6.0/src/utils/transaction/prepareRequest.ts#L89
    logger.trace({ msg: 'Harvesting strat', data: { chain, strategyAddress } });
    const transactionHash = await walletClient.writeContract({
        abi: IStrategyABI,
        address: strategyAddress,
        functionName: 'harvest',
        args: [walletAccount.address],
        account: walletAccount,
    });
    logger.debug({ msg: 'Harvested strat', data: { chain, transactionHash } });

    // wait for the transaction to be mined so we have a proper nonce for the next transaction
    logger.trace({ msg: 'Waiting for transaction receipt', data: { chain, strategyAddress, transactionHash } });
    const receipt = await publicClient.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: rpcConfig.transaction.blockConfirmations,
        timeout: rpcConfig.transaction.timeoutMs,
        pollingInterval: rpcConfig.transaction.pollingIntervalMs,
    });
    logger.debug({ msg: 'Got transaction receipt', data: { chain, strategyAddress, transactionHash, receipt } });

    // now we officially harvested the strat
    logger.info({ msg: 'Harvested strat', data: { chain, strategyAddress, transactionHash, receipt } });
    return {
        transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        balanceBeforeWei,
    };
}

type CustomWalletActions<
    TTransport extends Transport = Transport,
    TChain extends ViemChain | undefined = ViemChain | undefined,
    TAccount extends Account | undefined = Account | undefined,
> = {
    harvest: ({ strategyAddress }: HarvestParameters) => Promise<HarvestReturnType>;
};

export function createCustomWalletActions({ chain }: { chain: Chain }) {
    return function customWalletActions<
        TTransport extends Transport = Transport,
        TChain extends ViemChain | undefined = ViemChain | undefined,
        TAccount extends Account | undefined = Account | undefined,
    >(client: Client<TTransport, TChain, TAccount>): CustomWalletActions<TTransport, TChain, TAccount> {
        return {
            harvest: args => harvest(client, chain, args),
        };
    };
}
