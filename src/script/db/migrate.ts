import { db_migrate } from '../../lib/db/migrate';
import { withDbClient } from '../../lib/db/utils';
import { notifyError } from '../../lib/notify';
import { rootLogger } from '../../util/logger';
import { runMain } from '../../util/process';

const logger = rootLogger.child({ module: 'db-migrate' });
async function main() {
    try {
        await db_migrate();
    } catch (err) {
        logger.error({ msg: 'Failed to migrate db', err });
        logger.trace(err);
        await notifyError({ doing: 'migrating db', data: { when: new Date() } }, err);
    }
}

runMain(
    withDbClient(main, {
        appName: 'cowllector-db-migrate',
        connectTimeoutMs: 10_000,
    })
);
