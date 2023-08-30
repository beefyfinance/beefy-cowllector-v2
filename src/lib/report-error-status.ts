import { get } from 'lodash';
import { Async } from '../util/async';
import { Chain } from './chain';

export type ReportAsyncStatus = 'success' | 'error' | 'silent-error' | 'warning' | 'not-started';

/**
 * Some errors are unavoidable and we should not be warned about them.
 */
export function getReportAsyncStatus<T>({ chain }: { chain: Chain }, report: Async<T> | T | null): ReportAsyncStatus {
    if (report === null) {
        return 'not-started';
    }
    if (get(report, 'status', undefined) === 'fulfilled') {
        if (get(report, 'value.warning', false)) {
            return 'warning';
        }
        return 'success';
    } else if (get(report, 'status', undefined) === 'rejected') {
        if (chain === 'zkevm' && get(report, 'reason.details', '') === 'failed to execute the unsigned transaction') {
            return 'silent-error';
        }
        return 'error';
    } else {
        if (get(report, 'warning', false)) {
            return 'warning';
        }
        return 'success';
    }
}

export function mergeReportAsyncStatus<A, B>(statusA: ReportAsyncStatus, statusB: ReportAsyncStatus) {
    if (statusA === 'error' || statusB === 'error') {
        return 'error';
    }
    if (statusA === 'silent-error' || statusB === 'silent-error') {
        return 'silent-error';
    }
    if (statusA === 'warning' || statusB === 'warning') {
        return 'warning';
    }
    if (statusA === 'success' || statusB === 'success') {
        return 'success';
    }
    return 'not-started';
}

export function getMergedReportAsyncStatus<T>(
    { chain }: { chain: Chain },
    reports: Array<Async<T> | T | null>
): ReportAsyncStatus {
    let aggStatus: ReportAsyncStatus = 'not-started';
    for (const report of reports) {
        const reportStatus = getReportAsyncStatus({ chain }, report);
        aggStatus = mergeReportAsyncStatus(aggStatus, reportStatus);
    }
    return aggStatus;
}
