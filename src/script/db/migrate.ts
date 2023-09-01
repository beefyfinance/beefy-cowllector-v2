import { runMain } from '../../util/process';
import { db_migrate } from '../../lib/db/migrate';
import { withDbClient } from '../../lib/db/utils';

async function main() {
    await db_migrate();
}

runMain(withDbClient(main, { appName: 'cowllector_migrate', connectTimeoutMs: 10_000 }));
