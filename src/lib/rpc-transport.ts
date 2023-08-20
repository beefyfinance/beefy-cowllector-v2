import { HttpTransport, HttpTransportConfig, RpcRequestError, UrlRequiredError, createTransport } from 'viem';
import { RpcRequest, rpc } from 'viem/utils';
import { rootLogger } from '../util/logger';

const logger = rootLogger.child({ module: 'rpc-transport' });
const loggingHttpCall: typeof rpc.http = async (url, options) => {
    logger.trace({ msg: 'rpc.http: request', data: { url, body: options.body } });
    try {
        const res = await rpc.http(url, options);
        logger.debug({ msg: 'rpc.http: OK', data: { url, body: options.body, res } });
        return res;
    } catch (err) {
        logger.error({ msg: 'rpc.http: ERROR', data: { url, body: options.body, err } });
        throw err;
    }
};

/**
 * Monkey-patch the `rpc.http` function to log requests and responses.
 */
export function loggingHttpTransport(
    /** URL of the JSON-RPC API. Defaults to the chain's public RPC URL. */
    url?: string,
    config: HttpTransportConfig = {}
): HttpTransport {
    const { batch, fetchOptions, key = 'http', name = 'HTTP JSON-RPC', retryDelay } = config;
    return ({ chain, retryCount: retryCount_, timeout: timeout_ }) => {
        const { batchSize = 1000, wait = 0 } = typeof batch === 'object' ? batch : {};
        const retryCount = config.retryCount ?? retryCount_;
        const timeout = timeout_ ?? config.timeout ?? 10_000;
        const url_ = url || chain?.rpcUrls.default.http[0];
        if (!url_) throw new UrlRequiredError();
        return createTransport(
            {
                key,
                name,
                async request({ method, params }) {
                    const body = { method, params };

                    const { schedule } = createBatchScheduler({
                        id: `${url}`,
                        wait,
                        shouldSplitBatch(requests) {
                            return requests.length > batchSize;
                        },
                        fn: (body: RpcRequest[]) =>
                            loggingHttpCall(url_, {
                                body,
                                fetchOptions,
                                timeout,
                            }),
                    });

                    const fn = async (body: RpcRequest) =>
                        batch ? schedule(body) : [await loggingHttpCall(url_, { body, fetchOptions, timeout })];

                    const [{ error, result }] = await fn(body);
                    if (error)
                        throw new RpcRequestError({
                            body,
                            error,
                            url: url_,
                        });
                    return result;
                },
                retryCount,
                retryDelay,
                timeout,
                type: 'http',
            },
            {
                url,
            }
        );
    };
}

// VIEM utils/promises/createBatchScheduler.ts
// but I couldn't import it because it's not exported
// import { createBatchScheduler } from '../../node_modules/viem/src/utils/promise/createBatchScheduler';

type Resolved<TReturnType extends readonly unknown[] = any> = [result: TReturnType[number], results: TReturnType];

type PendingPromise<TReturnType extends readonly unknown[] = any> = {
    resolve?: (data: Resolved<TReturnType>) => void;
    reject?: (reason?: unknown) => void;
};

type SchedulerItem = { args: unknown; pendingPromise: PendingPromise };

type CreateBatchSchedulerArguments<
    TParameters = unknown,
    TReturnType extends readonly unknown[] = readonly unknown[],
> = {
    fn: (args: TParameters[]) => Promise<TReturnType>;
    id: number | string;
    shouldSplitBatch?: (args: TParameters[]) => boolean;
    wait?: number;
};
type CreateBatchSchedulerReturnType<
    TParameters = unknown,
    TReturnType extends readonly unknown[] = readonly unknown[],
> = {
    flush: () => void;
    schedule: TParameters extends undefined
        ? (args?: TParameters) => Promise<Resolved<TReturnType>>
        : (args: TParameters) => Promise<Resolved<TReturnType>>;
};

const schedulerCache = /*#__PURE__*/ new Map<number | string, SchedulerItem[]>();

function createBatchScheduler<TParameters, TReturnType extends readonly unknown[]>({
    fn,
    id,
    shouldSplitBatch,
    wait = 0,
}: CreateBatchSchedulerArguments<TParameters, TReturnType>): CreateBatchSchedulerReturnType<TParameters, TReturnType> {
    const exec = async () => {
        const scheduler = getScheduler();
        flush();

        const args = scheduler.map(({ args }) => args);

        if (args.length === 0) return;

        fn(args as TParameters[])
            .then(data => {
                scheduler.forEach(({ pendingPromise }, i) => pendingPromise.resolve?.([data[i], data]));
            })
            .catch(err => {
                scheduler.forEach(({ pendingPromise }) => pendingPromise.reject?.(err));
            });
    };

    const flush = () => schedulerCache.delete(id);

    const getBatchedArgs = () => getScheduler().map(({ args }) => args) as TParameters[];

    const getScheduler = () => schedulerCache.get(id) || [];

    const setScheduler = (item: SchedulerItem) => schedulerCache.set(id, [...getScheduler(), item]);

    return {
        flush,
        async schedule(args: TParameters) {
            const pendingPromise: PendingPromise<TReturnType> = {};
            const promise = new Promise<Resolved<TReturnType>>((resolve, reject) => {
                pendingPromise.resolve = resolve;
                pendingPromise.reject = reject;
            });

            const split = shouldSplitBatch?.([...getBatchedArgs(), args]);

            if (split) exec();

            const hasActiveScheduler = getScheduler().length > 0;
            if (hasActiveScheduler) {
                setScheduler({ args, pendingPromise });
                return promise;
            }

            setScheduler({ args, pendingPromise });
            setTimeout(exec, wait);
            return promise;
        },
    } as unknown as CreateBatchSchedulerReturnType<TParameters, TReturnType>;
}
