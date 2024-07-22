import { http, type HttpTransport, type HttpTransportConfig } from 'viem';
import { rootLogger } from '../util/logger';

const logger = rootLogger.child({ module: 'rpc-transport' });

export function loggingHttpTransport(url?: string, config: HttpTransportConfig = {}): HttpTransport {
    return http(url, {
        onFetchRequest: async request => {
            const content = await request.clone().text();
            logger.trace({ msg: 'rpc.http: request', data: content });
        },
        onFetchResponse: async response => {
            const content = await response.clone().text();
            logger.debug({ msg: 'rpc.http: response', data: content });
        },
        ...config,
    });
}
