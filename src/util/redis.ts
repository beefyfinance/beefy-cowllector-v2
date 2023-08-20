import * as redis from 'redis';
import type { RedisClientType } from 'redis';
import { REDIS_URL } from '../lib/config';
import { rootLogger } from './logger';
import { sleep } from './promise';

const logger = rootLogger.child({ module: 'redis' });

let redisClient: RedisClientType | null = null;
let isReady = false;
export async function getRedisClient() {
    if (!redisClient) {
        const startedAt = Date.now();
        redisClient = redis.createClient({
            url: REDIS_URL,
        });

        redisClient.on('error', err => logger.error({ msg: 'Redis Error', data: err }));
        redisClient.on('connect', () => logger.debug({ msg: 'Redis connected' }));
        redisClient.on('reconnecting', () => logger.warn({ msg: 'Redis reconnecting' }));
        redisClient.on('ready', () => {
            isReady = true;
            logger.debug({ msg: 'Redis ready', data: { durationMs: Date.now() - startedAt } });
        });

        redisClient.connect();

        let maxAttempts = 100;
        while (!isReady && maxAttempts-- > 0) {
            await sleep(100);
        }
        if (!isReady) {
            redisClient.quit();
            throw new Error('Redis did not become ready in time');
        }
    }

    return redisClient;
}
