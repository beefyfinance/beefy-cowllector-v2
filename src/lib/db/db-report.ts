import { rootLogger } from '../../util/logger';
import { DB_REPORTS_RETENTION_IN_DAYS } from '../config';
import { HarvestReport } from '../harvest-report';
import { serializeReport } from '../reports';
import { UnwrapReport } from '../unwrap-report';
import { db_query, db_query_one } from './utils';

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

export function insertHarvestReport(report: HarvestReport) {
    return insertReport('harvest', report);
}

export function insertUnwrapReport(report: UnwrapReport) {
    return insertReport('unwrap', report);
}

async function insertReport(
    reportType: 'harvest' | 'unwrap',
    report: HarvestReport | UnwrapReport
): Promise<{ raw_report_id: number }> {
    logger.debug({ msg: 'Inserting harvest reports', data: { chain: report.chain, reportType } });
    const res = await db_query_one<{ raw_report_id: number }>(
        `
            INSERT INTO raw_report (report_type, chain, datetime, report_content)
            VALUES %L
            RETURNING raw_report_id
        `,
        [[[reportType, report.chain, new Date().toISOString(), serializeReport(report, false)]]]
    );
    if (!res) {
        throw new Error('Failed to insert harvest report');
    }
    logger.info({ msg: 'Harvest reports inserted', data: { chain: report.chain, reportType } });
    return res;
}
