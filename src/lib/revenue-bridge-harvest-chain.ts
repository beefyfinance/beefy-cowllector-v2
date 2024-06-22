import { BeefyRevenueBridgeABI } from '../abi/BeefyRevenueBridgeABI';
import { bigintMultiplyFloat } from '../util/bigint';
import { rootLogger } from '../util/logger';
import type { Chain } from './chain';
import { fetchCollectorBalance } from './collector-balance';
import { RPC_CONFIG } from './config';
import {
    type RevenueBridgeHarvestReport,
    reportOnSingleRevenueBridgeHarvestAsyncCall,
} from './revenue-bridge-harvest-report';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from './rpc-client';

const logger = rootLogger.child({ module: 'revenue-bridge-harvest' });

export async function revenueBridgeHarvestChain({
    report,
    chain,
}: {
    report: RevenueBridgeHarvestReport;
    chain: Chain;
}) {
    if (!RPC_CONFIG[chain].revenueBridgeHarvest.enabled) {
        logger.debug({
            msg: 'Revenue bridge harvest is disabled for chain',
            data: { chain },
        });
        return report;
    }

    logger.debug({ msg: 'Revenue bridge harvest for chain', data: { chain } });

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];
    const revenueBridgeAddress = RPC_CONFIG[chain].contracts.revenueBridge;

    if (!revenueBridgeAddress) {
        logger.warn({
            msg: 'No revenue bridge address for chain',
            data: { chain },
        });
        return report;
    }

    // ======================
    // get some context first
    // ======================

    const item = await reportOnSingleRevenueBridgeHarvestAsyncCall({ report }, 'collectorBalanceBefore', () =>
        fetchCollectorBalance({ chain })
    );

    // ========================
    // now harvest if necessary
    // ========================
    await reportOnSingleRevenueBridgeHarvestAsyncCall(item, 'harvestTransaction', async item => {
        logger.trace({
            msg: 'Fetching total gas before',
            data: { chain, strat: item },
        });
        const remainingGasWei = await publicClient.getBalance({
            address: walletAccount.address,
        });

        logger.info({
            msg: 'Estimating gas for revenue bridge harvest call',
            data: { chain, strat: item },
        });

        let gasLimit = RPC_CONFIG[chain].revenueBridgeHarvest.forceGasLimit;
        let rawGasEstimation = gasLimit;
        if (gasLimit === null) {
            rawGasEstimation = await publicClient.estimateContractGas({
                abi: BeefyRevenueBridgeABI,
                address: revenueBridgeAddress,
                functionName: 'harvest',
                account: walletAccount,
            });
            gasLimit = bigintMultiplyFloat(
                rawGasEstimation,
                rpcConfig.revenueBridgeHarvest.balanceCheck
                    .minGasInWalletThresholdAsMultiplierOfEstimatedTransactionCost
            );
        }

        logger.trace({
            msg: 'Revenue Bridge harvesting',
            data: { chain, strat: item },
        });
        const { transactionHash, transactionReceipt } = await walletClient.aggressivelyWriteContract({
            abi: BeefyRevenueBridgeABI,
            address: revenueBridgeAddress,
            functionName: 'harvest',
            account: walletAccount,
            gas: rpcConfig.revenueBridgeHarvest.setTransactionGasLimit ? gasLimit : undefined,
        });
        logger.debug({
            msg: 'Got transaction receipt',
            data: { chain, strat: item, transactionHash, transactionReceipt },
        });

        logger.info({
            msg: 'Revenue Bridge harvested',
            data: { chain, strat: item, transactionHash, transactionReceipt },
        });
        return {
            transactionHash,
            rawGasEstimation: rawGasEstimation ?? gasLimit,
            gasLimit,
            blockNumber: transactionReceipt.blockNumber,
            gasUsed: transactionReceipt.gasUsed,
            effectiveGasPrice: transactionReceipt.effectiveGasPrice,
            balanceBeforeWei: remainingGasWei,
        };
    });

    // ===============
    // final reporting
    // ===============

    // fetching this additional info shouldn't crash the whole harvest
    try {
        await reportOnSingleRevenueBridgeHarvestAsyncCall({ report }, 'collectorBalanceAfter', () =>
            fetchCollectorBalance({ chain })
        );
    } catch (e) {
        logger.error({
            msg: 'Error getting collector balance after',
            data: { chain, e },
        });
    }

    return report;
}
