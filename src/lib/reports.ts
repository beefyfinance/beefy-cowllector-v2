import { BaseError, TimeoutError } from 'viem';
import { Async, AsyncSuccessType, promiseTimings } from '../util/async';
import { get, set } from 'lodash';
import { runSequentially, splitPromiseResultsByStatus } from '../util/promise';
import { rootLogger } from '../util/logger';
import { Prettify } from 'viem/dist/types/types/utils';

const logger = rootLogger.child({ module: 'report' });

/**
 * This type is used to properly type the result of the helper functions belo
 */

export type AItem<TReport> = { report: TReport };
export type AKey<TReport> = keyof TReport & string;
export type AVal<TReport, TReportKey> = TReportKey extends AKey<TReport>
    ? AsyncSuccessType<TReport[TReportKey]>
    : never;

/**
 * Method to update the report with the result of an async call even if it fails
 * But still throw the error if it fails so our usage of this method is not too confusing
 *
 * Takes care of:
 * - logging and tracing
 * - error handling
 * - updating the report
 * - timing the calls
 * - properly typing the result
 */
export async function reportOnSingleAsyncCall<
    TReport,
    TKey extends AKey<TReport>,
    TItem extends AItem<TReport>,
    TVal extends AVal<TReport, TKey>,
>(item: TItem, reportKey: TKey, make: (item: TItem) => Promise<TVal>): Promise<TItem & { [k in TKey]: TVal }> {
    logger.info({ msg: 'Running async call', data: { reportKey } });
    const result = await promiseTimings(() => make(item));
    if (result.status === 'rejected') {
        logger.error({ msg: 'Report step failed', data: { reportKey, item, error: result.reason } });
        item.report[reportKey] = formatAsyncResult(result) as TReport[TKey];
        throw result.reason;
    } else {
        logger.trace({ msg: 'Report step succeeded', data: { reportKey, item, result } });
        item.report[reportKey] = formatAsyncResult(result) as TReport[TKey];
        return { ...item, [reportKey]: result.value } as TItem & {
            [k in TKey]: TVal;
        };
    }
}

/**
 * Run a report step on a list of items
 * Takes care of:
 * - logging and tracing
 * - error handling
 * - updating the report
 * - returning the successful results only
 * - timing the calls
 * - running in parallel or sequentially
 * - adding the result to the items themselves
 * - properly typing the result
 */
export async function reportOnMultipleAsyncCall<
    TReport,
    TKey extends AKey<TReport>,
    TItem extends AItem<TReport>,
    TVal extends AVal<TReport, TKey>,
>(
    items: TItem[],
    reportKey: TKey,
    mode: 'parallel' | 'sequential',
    make: (item: TItem) => Promise<TVal>
): Promise<Prettify<TItem & { [k in TKey]: TVal }>[]> {
    logger.info({ msg: 'Running report step', data: { reportKey, itemsCount: items.length } });

    const processItem = async (item: TItem) => {
        const result = await promiseTimings(() => make(item));
        if (result.status === 'rejected') {
            logger.error({ msg: 'Report step failed', data: { reportKey, item, error: result.reason } });
            logger.trace(result.reason);
            item.report[reportKey] = formatAsyncResult(result) as TReport[TKey];
            throw result.reason;
        } else {
            logger.trace({ msg: 'Report step succeeded', data: { reportKey, item, result } });
            item.report[reportKey] = formatAsyncResult(result) as TReport[TKey];
            return { ...item, [reportKey]: result.value } as TItem & {
                [k in TKey]: TVal;
            };
        }
    };

    const results = await (mode === 'parallel'
        ? Promise.allSettled(items.map(processItem))
        : runSequentially(items, processItem));
    const { fulfilled, rejected } = splitPromiseResultsByStatus(results);

    logger.info({
        msg: 'Report step results',
        data: { reportKey, itemsCount: items.length, fulfilledCount: fulfilled.length, rejectedCount: rejected.length },
    });
    if (rejected.length > 0) {
        logger.debug({ msg: 'Skipped items', data: { reportKey, items: rejected.length } });
    }
    logger.trace({ msg: 'Report step finished', data: { reportKey, itemsCount: items.length, fulfilled, rejected } });

    return fulfilled;
}

/**
 * Format an async result to make it more readable, especially for errors
 */
function formatAsyncResult<T>(asyncResult: Async<T>): Async<T> {
    if (asyncResult.status === 'rejected') {
        // prettify the error
        const error = asyncResult.reason;
        if (error instanceof TimeoutError) {
            return { status: 'rejected', reason: 'Request timed out', timing: asyncResult.timing } as Async<T>;
        } else if (error instanceof BaseError) {
            // remove abi from the error object
            if (get(error, 'abi')) {
                set(error, 'abi', undefined);
            }
            return { status: 'rejected', reason: error, timing: asyncResult.timing } as Async<T>;
        } else if (error instanceof Error) {
            error;
            return {
                status: 'rejected',
                reason: { name: error.name, message: error.message, cause: error.cause, stack: error.stack },
                timing: asyncResult.timing,
            } as Async<T>;
        }
        return asyncResult;
    }
    return { status: 'fulfilled', value: asyncResult.value, timing: asyncResult.timing } as Async<T>;
}

/**
 * JSON.stringify cannot handle BigInt and set a good format for dates, so we need to serialize it ourselves
 */
export function serializeReport(o: object, pretty: boolean = false): string {
    return JSON.stringify(
        o,
        (_, value) => {
            // handle BigInt
            if (typeof value === 'bigint') {
                return value.toString();
            }
            // handle dates
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        },
        pretty ? 2 : undefined
    );
}
