import { Client as PgClient, type ClientConfig as PgClientConfig } from 'pg';
import * as pgcs from 'pg-connection-string';
import pgf from 'pg-format';
import { rootLogger } from '../../util/logger';
import { ConnectionTimeoutError, isConnectionTimeoutError, withTimeout } from '../../util/promise';
import { DATABASE_SSL, DATABASE_URL } from '../config';

const logger = rootLogger.child({ module: 'db', component: 'query' });

type DbClient = {
    connect: PgClient['connect'];
    query: PgClient['query'];
    end: PgClient['end'];
    on: PgClient['on'];
};

let sharedClient: DbClient | null = null;
const appNameCounters: Record<string, number> = {};
async function getDbClient({
    appName = 'beefy_cowllector',
    freshClient = false,
}: {
    appName?: string;
    freshClient?: boolean;
}) {
    if (!appNameCounters[appName]) {
        appNameCounters[appName] = 0;
    }

    if (sharedClient === null) {
        appNameCounters[appName] += 1;
        const appNameToUse = `${appName}:common:${appNameCounters[appName]}`;

        const pgUrl = DATABASE_URL;
        const config = pgcs.parse(pgUrl) as PgClientConfig;
        logger.trace({
            msg: 'Instantiating new shared pg client',
            data: { appNameToUse },
        });
        sharedClient = new PgClient({
            ...config,
            application_name: appNameToUse,
            ssl: DATABASE_SSL
                ? {
                      rejectUnauthorized: false,
                  }
                : undefined,
        });
        sharedClient.on('error', (err: unknown) => {
            logger.error({
                msg: 'Postgres client error',
                data: { err, appNameToUse },
            });
            logger.error(err);
        });
    }
    if (freshClient) {
        appNameCounters[appName] += 1;
        const appNameToUse = `${appName}:fresh:${appNameCounters[appName]}`;

        const pgUrl = DATABASE_URL;
        const config = pgcs.parse(pgUrl) as PgClientConfig;
        logger.trace({
            msg: 'Instantiating new unique pg client',
            data: { appNameToUse },
        });
        return new PgClient({ ...config, application_name: appNameToUse });
    }

    return sharedClient;
}

// inject pg client as first argument
export function withDbClient<TArgs extends unknown[], TRes>(
    fn: (client: DbClient, ...args: TArgs) => Promise<TRes>,
    { appName, connectTimeoutMs = 10_000 }: { appName: string; connectTimeoutMs?: number }
): (...args: TArgs) => Promise<TRes> {
    return async (...args: TArgs) => {
        const pgClient = await getDbClient({ appName, freshClient: false });
        let res: TRes;
        try {
            logger.trace({
                msg: 'Connecting to pg',
                data: { appName, connectTimeoutMs },
            });
            await withTimeout(() => pgClient.connect(), connectTimeoutMs);
            res = await fn(pgClient, ...args);
        } finally {
            await pgClient.end();
        }
        return res;
    };
}

export async function db_query<RowType>(
    sql: string,
    params: unknown[] = [],
    client: DbClient | null = null
): Promise<RowType[]> {
    logger.trace({ msg: 'Executing query', data: { sql, params } });
    let useClient: DbClient | null = client;
    if (useClient === null) {
        const pool = await getDbClient({ freshClient: false });
        useClient = pool;
    }
    const sql_w_params = pgf(sql, ...params);
    //console.log(sql_w_params);
    try {
        const res = await useClient.query(sql_w_params);
        const rows = res?.rows || null;
        logger.trace({
            msg: 'Query end',
            data: { sql, params, total: res?.rowCount },
        });
        return rows;
    } catch (error) {
        // if the query ended because of a connection timeout, we wrap it in a custom error
        // so that we can handle it upper in the stack and retry the query/transaction
        if (isConnectionTimeoutError(error)) {
            throw new ConnectionTimeoutError(0, error);
        }
        logger.error({ msg: 'Query error', data: { sql, params, error } });
        throw error;
    }
}

export async function db_query_one<RowType>(
    sql: string,
    params: unknown[] = [],
    client: DbClient | null = null
): Promise<RowType | null> {
    const rows = await db_query<RowType>(sql, params, client);
    if (rows.length === 0) {
        return null;
    }
    return rows[0];
}

// postgresql don't have "create type/domain if not exists"
export async function typeExists(typeName: string) {
    const res = await db_query_one('SELECT * FROM pg_type WHERE typname = %L', [typeName]);
    return res !== null;
}
