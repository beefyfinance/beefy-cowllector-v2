import { HttpTransport, HttpTransportConfig, http } from 'viem';
import { rootLogger } from '../util/logger';

const logger = rootLogger.child({ module: 'rpc-transport' });

export function loggingHttpTransport(
    /** URL of the JSON-RPC API. Defaults to the chain's public RPC URL. */
    url?: string,
    config: HttpTransportConfig = {}
): HttpTransport {
    return http(url, {
        onFetchRequest: request => {
            logger.trace({ msg: 'rpc.http: request', data: request });
        },
        onFetchResponse(response) {
            logger.debug({ msg: 'rpc.http: response', data: response });
        },
        ...config,
    });
}
