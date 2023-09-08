import type { Chain } from './chain';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from './rpc-client';
import { RPC_CONFIG } from './config';
import { rootLogger } from '../util/logger';
import { UnwrapReport, reportOnSingleUnwrapAsyncCall } from './unwrap-report';
import { fetchCollectorBalance } from './collector-balance';
import { WETHABI } from '../abi/WETHABI';
import { getChainWNativeTokenAddress } from './addressbook';
import { bigintMultiplyFloat } from '../util/bigint';

const logger = rootLogger.child({ module: 'unwrap-wnative' });

export async function unwrapChain({ report, chain }: { report: UnwrapReport; chain: Chain }) {
    if (!RPC_CONFIG[chain].unwrap.enabled) {
        logger.debug({ msg: 'Unwrap is disabled for chain', data: { chain } });
        return report;
    }

    logger.debug({ msg: 'Unwrapping wnative for chain', data: { chain } });

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];
    const wnative = getChainWNativeTokenAddress(chain);

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
        if (item.collectorBalanceBefore.wnativeBalanceWei < rpcConfig.unwrap.minAmountOfWNativeWei) {
            return {
                shouldUnwrap: false,
                minAmountOfWNativeWei: rpcConfig.unwrap.minAmountOfWNativeWei,
                actualAmount: item.collectorBalanceBefore.wnativeBalanceWei,
                notUnwrappingReason: 'too few wnative to unwrap',
            };
        }

        if (item.collectorBalanceBefore.balanceWei > rpcConfig.unwrap.maxAmountOfNativeWei) {
            return {
                shouldUnwrap: false,
                maxAmountOfNativeWei: rpcConfig.unwrap.maxAmountOfNativeWei,
                actualAmount: item.collectorBalanceBefore.balanceWei,
                notUnwrappingReason: 'still got plenty of native left',
            };
        }

        return {
            shouldUnwrap: true,
            triggerAmount: rpcConfig.unwrap.minAmountOfWNativeWei,
            actualAmount: item.collectorBalanceBefore.wnativeBalanceWei,
        };
    });

    // =======================
    // now unwrap if necessary
    // =======================
    if (unwrapDecision.unwrapDecision === null || !unwrapDecision.unwrapDecision.shouldUnwrap) {
        logger.debug({ msg: 'Not unwrapping', data: { chain, unwrapDecision } });
        return report;
    }

    await reportOnSingleUnwrapAsyncCall(unwrapDecision, 'unwrapTransaction', async item => {
        logger.trace({ msg: 'Fetching total gas before', data: { chain, strat: item } });
        const remainingGasWei = await publicClient.getBalance({ address: walletAccount.address });

        logger.info({ msg: 'Estimating gas for unwrap call', data: { chain, strat: item } });
        const rawGasEstimation = await publicClient.estimateContractGas({
            abi: WETHABI,
            address: wnative,
            functionName: 'withdraw',
            args: [item.unwrapDecision.actualAmount],
            account: walletAccount,
        });
        const gasLimit = bigintMultiplyFloat(
            rawGasEstimation,
            rpcConfig.unwrap.balanceCheck.minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost
        );

        logger.trace({ msg: 'Unwrapping wnative', data: { chain, strat: item } });
        const { transactionHash, transactionReceipt } = await walletClient.aggressivelyWriteContract({
            abi: WETHABI,
            address: wnative,
            functionName: 'withdraw',
            args: [item.unwrapDecision.actualAmount],
            account: walletAccount,
            gas: gasLimit,
        });
        logger.debug({
            msg: 'Got transaction receipt',
            data: { chain, strat: item, transactionHash, transactionReceipt },
        });

        logger.info({ msg: 'Unwrapped wnative', data: { chain, strat: item, transactionHash, transactionReceipt } });
        return {
            transactionHash,
            rawGasEstimation,
            gasLimit,
            blockNumber: transactionReceipt.blockNumber,
            gasUsed: transactionReceipt.gasUsed,
            effectiveGasPrice: transactionReceipt.effectiveGasPrice,
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
