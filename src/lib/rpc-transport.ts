import { http, type HttpTransport, type HttpTransportConfig } from 'viem';
import { rootLogger } from '../util/logger';

const logger = rootLogger.child({ module: 'rpc-transport' });

export function loggingHttpTransport(url?: string, config: HttpTransportConfig = {}): HttpTransport {
    return http(url, {
        onFetchRequest: async request => {
            const content = await request.json();
            logger.trace({ msg: 'rpc.http: request', data: content });
            // @ts-ignore: avoid `Body is unusable` error
            request.json = async () => content;
        },
        onFetchResponse: async response => {
            const content = await response.json();
            logger.debug({ msg: 'rpc.http: response', data: content });
            // @ts-ignore: avoid `Body is unusable` error
            response.json = async () => content;
        },
        ...config,
    });
}
