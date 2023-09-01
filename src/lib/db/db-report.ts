import { rootLogger } from '../../util/logger';
import { DB_REPORTS_RETENTION_IN_DAYS } from '../config';
import { HarvestReport } from '../harvest-report';
import { serializeReport } from '../reports';
import { db_query } from './utils';

const logger = rootLogger.child({ module: 'db-report' });

export async function applyRetention() {
    logger.debug({ msg: 'Applying retention', data: { DB_REPORTS_RETENTION_IN_DAYS } });
    await db_query(
        `
            DELETE FROM raw_report
            WHERE datetime < (NOW() - (%L || ' day')::interval)
        `,
        [DB_REPORTS_RETENTION_IN_DAYS.toFixed()]
    );
    logger.info({ msg: 'Retention applied', data: { DB_REPORTS_RETENTION_IN_DAYS } });
}

export async function insertHarvestReports(reports: HarvestReport[]) {
    if (reports.length === 0) {
        return;
    }
    logger.debug({ msg: 'Inserting harvest reports', data: { count: reports.length } });
    await db_query(
        `
            INSERT INTO raw_report (report_type, chain, datetime, report_content)
            VALUES %L
        `,
        [reports.map(report => ['harvest', report.chain, new Date().toISOString(), serializeReport(report, false)])]
    );
    logger.info({ msg: 'Harvest reports inserted', data: { count: reports.length } });
}
