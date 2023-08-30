import { TimingData } from '../util/async';
import { Chain } from './chain';
import { getMergedReportAsyncStatus, getReportAsyncStatus, mergeReportAsyncStatus } from './report-error-status';

describe('getReportAsyncStatus', () => {
    const timing: TimingData = { durationMs: 1, endedAt: new Date(), startedAt: new Date() };
    const chain: Chain = 'ethereum';
    it('should return not-started if report is null', () => {
        expect(getReportAsyncStatus({ chain }, null)).toEqual('not-started');
    });
    it('should return success for an async report in success', () => {
        expect(getReportAsyncStatus({ chain }, { status: 'fulfilled', value: { ok: true }, timing })).toEqual(
            'success'
        );
    });
    it('should warn when an async report is in success and has a warning', () => {
        expect(getReportAsyncStatus({ chain }, { status: 'fulfilled', value: { warning: true }, timing })).toEqual(
            'warning'
        );
    });
    it('should return error when an async report is in rejected', () => {
        expect(getReportAsyncStatus({ chain }, { status: 'rejected', reason: 'some error', timing })).toEqual('error');
    });
    it('should return silent-error when an async report is in rejected with a specific error and the chain is zkevm', () => {
        expect(
            getReportAsyncStatus(
                { chain: 'zkevm' },
                { status: 'rejected', reason: { details: 'failed to execute the unsigned transaction' }, timing }
            )
        ).toEqual('silent-error');
    });
    it('should warn when a report is not async and has a warning', () => {
        expect(getReportAsyncStatus({ chain }, { warning: true })).toEqual('warning');
    });
    it('should return success when a report is not async and has no warning', () => {
        expect(getReportAsyncStatus({ chain }, {})).toEqual('success');
    });
});

describe('mergeReportAsyncStatus', () => {
    it('should return error if one of the status is error', () => {
        expect(mergeReportAsyncStatus('error', 'success')).toEqual('error');
        expect(mergeReportAsyncStatus('success', 'error')).toEqual('error');
        expect(mergeReportAsyncStatus('error', 'silent-error')).toEqual('error');
        expect(mergeReportAsyncStatus('silent-error', 'error')).toEqual('error');
        expect(mergeReportAsyncStatus('error', 'warning')).toEqual('error');
        expect(mergeReportAsyncStatus('warning', 'error')).toEqual('error');
        expect(mergeReportAsyncStatus('error', 'not-started')).toEqual('error');
        expect(mergeReportAsyncStatus('not-started', 'error')).toEqual('error');
    });

    it('should return silent-error if one of the status is silent-error but none is in error', () => {
        expect(mergeReportAsyncStatus('silent-error', 'success')).toEqual('silent-error');
        expect(mergeReportAsyncStatus('success', 'silent-error')).toEqual('silent-error');
        expect(mergeReportAsyncStatus('silent-error', 'warning')).toEqual('silent-error');
        expect(mergeReportAsyncStatus('warning', 'silent-error')).toEqual('silent-error');
        expect(mergeReportAsyncStatus('silent-error', 'not-started')).toEqual('silent-error');
        expect(mergeReportAsyncStatus('not-started', 'silent-error')).toEqual('silent-error');
    });

    it('should return warning if one of the status is warning but none is in error or silent-error', () => {
        expect(mergeReportAsyncStatus('warning', 'success')).toEqual('warning');
        expect(mergeReportAsyncStatus('success', 'warning')).toEqual('warning');
        expect(mergeReportAsyncStatus('warning', 'not-started')).toEqual('warning');
        expect(mergeReportAsyncStatus('not-started', 'warning')).toEqual('warning');
    });

    it('should return success if none of the status is in error, silent-error or warning', () => {
        expect(mergeReportAsyncStatus('success', 'success')).toEqual('success');
        expect(mergeReportAsyncStatus('success', 'not-started')).toEqual('success');
        expect(mergeReportAsyncStatus('not-started', 'success')).toEqual('success');
        expect(mergeReportAsyncStatus('not-started', 'not-started')).toEqual('not-started');
    });
});

describe('getMergedReportAsyncStatus', () => {
    const timing: TimingData = { durationMs: 1, endedAt: new Date(), startedAt: new Date() };
    const chain: Chain = 'ethereum';
    it('should return the status of the worst report', () => {
        expect(
            getMergedReportAsyncStatus<any>({ chain }, [
                { status: 'fulfilled', value: { ok: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
            ])
        ).toEqual('warning');
        expect(
            getMergedReportAsyncStatus({ chain }, [
                { status: 'fulfilled', value: { ok: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
                { status: 'rejected', reason: 'some error', timing },
                { status: 'fulfilled', value: { warning: true }, timing },
            ])
        ).toEqual('error');
        expect(
            getMergedReportAsyncStatus({ chain }, [
                { status: 'fulfilled', value: { ok: true }, timing },
                { ok: true },
                { warning: true },
            ])
        ).toEqual('warning');
    });
});
