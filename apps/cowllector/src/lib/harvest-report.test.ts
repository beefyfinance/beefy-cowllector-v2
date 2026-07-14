import type { AsyncSuccessType } from '../util/async';
import type { IfEquals } from '../util/types-assert';
import type { HarvestReportDecision } from './harvest-report';
import type { ReportNotificationLevels } from './report-error-status';

describe('Harvest decision report level', () => {
    it('should be a typescript error if level is not compatible with ReportNotificationLevels', () => {
        // extract the type of the level field of the decision
        type HarvestReportDecisionNotificationLevels = AsyncSuccessType<HarvestReportDecision>['level'];

        // make sure both types are the same
        type EQ = IfEquals<HarvestReportDecisionNotificationLevels, ReportNotificationLevels, 'same', 'different'>;
        const eq: EQ = 'same';
        expect(eq).toEqual('same');
    });
});
