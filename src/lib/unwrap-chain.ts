import type { Chain } from './chain';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from './rpc-client';
import { RPC_CONFIG } from './config';
import { rootLogger } from '../util/logger';
import { UnwrapReport, reportOnSingleUnwrapAsyncCall } from './unwrap-report';
import { fetchCollectorBalance } from './collector-balance';
import { WETHABI } from '../abi/WETHABI';
import { getChainWNativeTokenAddress } from './addressbook';

const logger = rootLogger.child({ module: 'unwrap-wnative' });

export async function unwrapChain({ report, chain }: { report: UnwrapReport; chain: Chain }) {
    logger.debug({ msg: 'Unwrapping wnative for chain', data: { chain } });

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    // ======================
    // get some context first
    // ======================

    const item = await reportOnSingleUnwrapAsyncCall({ report }, 'collectorBalanceBefore', () =>
        fetchCollectorBalance({ chain })
    );

    // ===============
    // unwrap decision
    // ===============

    const unwrapDecision = await reportOnSingleUnwrapAsyncCall(item, 'unwrapDecision', async item => {
        const shouldUnwrap =
            item.collectorBalanceBefore.wnativeBalanceWei > 0n &&
            item.collectorBalanceBefore.wnativeBalanceWei < rpcConfig.unwrap.triggerAmountWei;

        if (!shouldUnwrap) {
            return {
                shouldUnwrap: false,
                triggerAmount: rpcConfig.unwrap.triggerAmountWei,
                actualAmount: item.collectorBalanceBefore.wnativeBalanceWei,
                notUnwrappingReason: 'too few wnative to unwrap',
            };
        } else {
            return {
                shouldUnwrap: true,
                triggerAmount: rpcConfig.unwrap.triggerAmountWei,
                actualAmount: item.collectorBalanceBefore.wnativeBalanceWei,
            };
        }
    });

    // =======================
    // now unwrap if necessary
    // =======================
    if (unwrapDecision.unwrapDecision === null || !unwrapDecision.unwrapDecision.shouldUnwrap) {
        logger.debug({ msg: 'Not unwrapping', data: { chain, unwrapDecision } });
        return report;
    }

    await reportOnSingleUnwrapAsyncCall(unwrapDecision, 'unwrapTransaction', async item => {
        // check if we have enough gas to harvest
        logger.trace({ msg: 'Checking gas', data: { chain, strat: item } });
        const remainingGasWei = await publicClient.getBalance({ address: walletAccount.address });

        logger.trace({ msg: 'Unwrapping wnative', data: { chain, strat: item } });
        const { request, result } = await publicClient.simulateContract({
            abi: WETHABI,
            address: getChainWNativeTokenAddress(chain),
            functionName: 'withdraw',
            args: [item.unwrapDecision.actualAmount],
            account: walletAccount,
        });
        logger.debug({ msg: 'Simulated unwrapped wnative', data: { chain, strat: item, result } });
        const transactionHash = await walletClient.writeContract(request);
        logger.debug({ msg: 'Unwrapped wnative', data: { chain, strat: item, transactionHash, result } });

        // wait for the transaction to be mined so we have a proper nonce for the next transaction
        logger.trace({ msg: 'Waiting for transaction receipt', data: { chain, strat: item, transactionHash } });
        const receipt = await publicClient.waitForTransactionReceipt({
            hash: transactionHash,
            confirmations: rpcConfig.transaction.blockConfirmations,
            timeout: rpcConfig.transaction.timeoutMs,
            pollingInterval: rpcConfig.transaction.pollingIntervalMs,
        });
        logger.debug({ msg: 'Got transaction receipt', data: { chain, strat: item, transactionHash, receipt } });

        // now we officially harvested the strat
        logger.info({ msg: 'Unwrapped wnative', data: { chain, strat: item, transactionHash, receipt } });
        return {
            transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
            balanceBeforeWei: remainingGasWei,
            unwrappedAmount: item.unwrapDecision.actualAmount,
        };
    });

    // ===============
    // final reporting
    // ===============

    // fetching this additional info shouldn't crash the whole harvest
    try {
        await reportOnSingleUnwrapAsyncCall({ report }, 'collectorBalanceAfter', () =>
            fetchCollectorBalance({ chain })
        );
    } catch (e) {
        logger.error({ msg: 'Error getting collector balance after', data: { chain, e } });
    }

    return report;
}
