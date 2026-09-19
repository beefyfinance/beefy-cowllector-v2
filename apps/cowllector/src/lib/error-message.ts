import { get } from 'lodash';

export function extractErrorMessage(e: unknown): string {
    const keys = ['reason.details', 'reason.shortMessage', 'reason.message', 'shortMessage', 'message', 'reason', 'details'];
    let errorMsg: string | undefined;

    for (const key of keys) {
        errorMsg = get(e, key);
        if (errorMsg) {
            return errorMsg;
        }
    }

    return 'unknown';
}

/**
 * True when a revert is exactly `NoRewards()` (`0x3fb087f4`).
 * The lens ABI does not include this error, so viem often only exposes the raw selector.
 */
export function isNoRewardsError(error: unknown, seen = new Set<unknown>()): boolean {
    const selector = '0x3fb087f4'; // NoRewards()
    const isSelector = (value: unknown) => typeof value === 'string' && value.toLowerCase() === selector;
    if (isSelector(error)) {
        return true;
    }
    if (error === null || typeof error !== 'object') {
        return false;
    }
    if (seen.has(error)) {
        return false;
    }
    seen.add(error);

    const record = error as Record<string, unknown>;
    if (record.errorName === 'NoRewards' || isSelector(record.signature) || isSelector(record.raw) || isSelector(record.data)) {
        return true;
    }
    if (record.data !== null && typeof record.data === 'object') {
        const data = record.data as Record<string, unknown>;
        if (data.errorName === 'NoRewards' || isSelector(data.data)) {
            return true;
        }
    }

    return isNoRewardsError(record.cause, seen) || isNoRewardsError(record.reason, seen) || isNoRewardsError(record.error, seen);
}
