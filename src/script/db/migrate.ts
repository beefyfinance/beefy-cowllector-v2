import { runMain } from '../../util/process';
import { db_migrate } from '../../lib/db/migrate';
import { withDbClient } from '../../lib/db/utils';
import { rootLogger } from '../../util/logger';
import { notifyError } from '../../lib/notify';

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

runMain(withDbClient(main, { appName: 'cowllector-db-migrate', connectTimeoutMs: 10_000 }));
