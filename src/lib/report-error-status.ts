import { get } from 'lodash';
import { Async } from '../util/async';
import { Chain } from './chain';
import { extractErrorMessage } from './error-message';
import { BeefyVault } from './vault';
import { VAULT_IDS_WE_ARE_OK_NOT_HARVESTING } from './config';

// info: do not show or alert in the notifier message
// notice: show in the notifier message but do not alert
// warning: show in the notifier message and alert
// error: show in the notifier message and alert but with flames
export type ReportNotificationLevels = 'error' | 'warning' | 'notice' | 'info';
export type ReportAsyncStatus = 'success' | ReportNotificationLevels | 'not-started';

export type ReportAsyncStatusContext = {
    chain: Chain;
    vault: BeefyVault | null;
};

/**
 * Some errors are unavoidable and we should not be warned about them.
 */
export function getReportAsyncStatus<T>(
    { chain, vault }: ReportAsyncStatusContext,
    report: Async<T> | null
): ReportAsyncStatus {
    if (report === null) {
        return 'not-started';
    }
    if (get(report, 'status', undefined) === 'fulfilled') {
        if (get(report, 'value.warning', false)) {
            return 'warning';
        }
        const level = get(report, 'value.level');
        if (level) {
            return level;
        }

        return 'success';
    } else if (get(report, 'status', undefined) === 'rejected') {
        if (chain === 'zkevm' && extractErrorMessage(report) === 'failed to execute the unsigned transaction') {
            return 'notice';
        }
        if (vault && VAULT_IDS_WE_ARE_OK_NOT_HARVESTING.includes(vault.id)) {
            return 'notice';
        }
        return 'error';
    } else {
        if (get(report, 'warning', false)) {
            return 'warning';
        }
        const level = get(report, 'value.level');
        if (level) {
            return level;
        }
        return 'success';
    }
}

const statusOrder: Record<ReportAsyncStatus, number> = {
    'not-started': 0,
    success: 1,
    info: 2,
    notice: 3,
    warning: 4,
    error: 5,
};

export function mergeReportAsyncStatus<A, B>(
    statusA: ReportAsyncStatus,
    statusB: ReportAsyncStatus
): ReportAsyncStatus {
    if (statusOrder[statusA] > statusOrder[statusB]) {
        return statusA;
    }
    return statusB;
}

export function getMergedReportAsyncStatus<T>(
    ctx: ReportAsyncStatusContext,
    reports: Array<Async<T> | null>
): ReportAsyncStatus {
    let aggStatus: ReportAsyncStatus = 'not-started';
    for (const report of reports) {
        const reportStatus = getReportAsyncStatus(ctx, report);
        aggStatus = mergeReportAsyncStatus(aggStatus, reportStatus);
    }
    return aggStatus;
}

export function getReportAsyncStatusCounts(statuses: ReportAsyncStatus[]): Record<ReportAsyncStatus, number> {
    const counts: Record<ReportAsyncStatus, number> = {
        'not-started': 0,
        success: 0,
        warning: 0,
        info: 0,
        notice: 0,
        error: 0,
    };
    for (const status of statuses) {
        counts[status] += 1;
    }
    return counts;
}
