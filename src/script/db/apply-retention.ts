import { runMain } from '../../util/process';
import { withDbClient } from '../../lib/db/utils';
import { applyRetention } from '../../lib/db/db-report';
import { rootLogger } from '../../util/logger';
import { notifyError } from '../../lib/notify';

const logger = rootLogger.child({ module: 'apply-retention' });
async function main() {
    try {
        await applyRetention();
    } catch (err) {
        logger.error({ msg: 'Failed to apply retention', err });
        logger.trace(err);

        await notifyError({ doing: 'applying db retention', data: { when: new Date() } }, err);
    }
}

runMain(withDbClient(main, { appName: 'cowllector-apply-retention', connectTimeoutMs: 10_000 }));
