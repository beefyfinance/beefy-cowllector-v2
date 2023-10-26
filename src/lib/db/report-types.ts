import { type HarvestReport } from '../harvest-report';
import { type RevenueBridgeHarvestReport } from '../revenue-bridge-harvest-report';
import { type UnwrapReport } from '../unwrap-report';

export type ReportType = 'harvest' | 'unwrap' | 'revenue-bridge-harvest';

export const allReportTypes: ReportType[] = ['harvest', 'unwrap', 'revenue-bridge-harvest'];

export type AnyReport = HarvestReport | UnwrapReport | RevenueBridgeHarvestReport;
