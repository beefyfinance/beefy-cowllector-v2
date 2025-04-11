import type { Chain } from './chain';
import { EXPLORER_CONFIG } from './config';
import { extractErrorMessage } from './error-message';
import type { HarvestReportItem } from './harvest-report';
import type { BeefyVault } from './vault';

export function extractHarvestReportItemErrorDiscordMessageDetails(
    chain: Chain,
    stratReport: HarvestReportItem
): string | null {
    if (stratReport.summary.status === 'not-started' || stratReport.summary.status === 'success') {
        return null;
    }
    const vaultLink = getVaultDiscordMessageLink(chain, stratReport.vault);
    const stratLink = getStrategyDiscordMessageLink(chain, stratReport.vault);
    let trxLink: string | null = null;
    if (stratReport.transaction && stratReport.transaction.status === 'fulfilled') {
        trxLink = getTransactionDiscordMessageLink(chain, stratReport.transaction.value.transactionHash);
    }
    const links = `${vaultLink} (strat: ${stratLink})${trxLink ? ` (trx: ${trxLink})` : ''}`;

    if (stratReport.simulation && stratReport.simulation.status === 'rejected') {
        const errorMsg = extractErrorMessage(stratReport.simulation);
        return `- simulation 🔥 ${links}: ${errorMsg}`;
    }
    if (stratReport.decision && stratReport.decision.status === 'rejected') {
        const errorMsg = extractErrorMessage(stratReport.decision);
        return `- decision 🔥 ${links}: ${errorMsg}`;
    }
    if (stratReport.decision && stratReport.decision.status === 'fulfilled') {
        if (stratReport.decision.value.level === 'error') {
            const errorMsg =
                stratReport.decision.value.notHarvestingReason +
                (stratReport.decision.value.notHarvestingReason === 'harvest would fail'
                    ? ` (block: ${stratReport.decision.value.blockNumber.toString()}, data: ${
                          stratReport.decision.value.harvestReturnData
                      })`
                    : '');
            return `- decision 🔥 ${links}: ${errorMsg}`;
        }
        if (stratReport.decision.value.level === 'warning') {
            const errorMsg = stratReport.decision.value.notHarvestingReason;
            return `- decision ⚠️ ${links}: ${errorMsg}`;
        }
        if (stratReport.decision.value.level === 'notice') {
            const errorMsg = stratReport.decision.value.notHarvestingReason;
            return `- decision ℹ️ ${links}: ${errorMsg}`;
        }
    }
    if (stratReport.transaction && stratReport.transaction.status === 'rejected') {
        const errorMsg = extractErrorMessage(stratReport.transaction);
        return `- transaction 🔥 ${links}: ${errorMsg}`;
    }

    return null;
}

export function getVaultDiscordMessageLink(chain: Chain, vault: BeefyVault): string {
    return `[${vault.id}](<https://app.beefy.finance/vault/${vault.id}>)`;
}

export function getStrategyDiscordMessageLink(chain: Chain, vault: BeefyVault): string {
    const explorerConfig = EXPLORER_CONFIG[chain];
    const stratExplorerLink = explorerConfig.addressLinkTemplate.replace('${address}', vault.strategyAddress);
    if (!vault.strategyAddress) {
        return '??';
    }
    const truncatedAddy = `${vault.strategyAddress.slice(0, 6)}...${vault.strategyAddress.slice(-4)}`;
    return `[${truncatedAddy}](<${stratExplorerLink}>)`;
}

export function getTransactionDiscordMessageLink(chain: Chain, transactionHash: string): string {
    const explorerConfig = EXPLORER_CONFIG[chain];
    const transactionExplorerLink = explorerConfig.transactionLinkTemplate.replace('${hash}', transactionHash);
    if (!transactionHash) {
        return '??';
    }
    const truncatedHash = `${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`;
    return `[${truncatedHash}](<${transactionExplorerLink}>)`;
}
