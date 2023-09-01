import { runMain } from '../../util/process';
import { withDbClient } from '../../lib/db/utils';
import { applyRetention } from '../../lib/db/db-report';

async function main() {
    await applyRetention();
}

runMain(withDbClient(main, { appName: 'cowllector-apply-retention', connectTimeoutMs: 10_000 }));
