import { TimingData } from '../util/async';
import {
    ReportAsyncStatusContext,
    getMergedReportAsyncStatus,
    getReportAsyncStatus,
    mergeReportAsyncStatus,
} from './report-error-status';
import { BeefyVault } from './vault';

import { VAULT_IDS_WITH_A_KNOWN_HARVEST_BUG } from './config';

jest.mock('./config', () => ({
    VAULT_IDS_WITH_A_KNOWN_HARVEST_BUG: ['this-vault-has-a-bug'],
}));

describe('getReportAsyncStatus', () => {
    const timing: TimingData = { durationMs: 1, endedAt: new Date(), startedAt: new Date() };
    const ctx: ReportAsyncStatusContext = {
        chain: 'ethereum',
        vault: {
            id: 'curve-weth-wsteth',
        } as any as BeefyVault,
    };

    it('should return not-started if report is null', () => {
        expect(getReportAsyncStatus(ctx, null)).toEqual('not-started');
    });
    it('should return success for an async report in success', () => {
        expect(getReportAsyncStatus(ctx, { status: 'fulfilled', value: { ok: true }, timing })).toEqual('success');
    });
    it('should warn when an async report is in success and has a warning', () => {
        expect(getReportAsyncStatus(ctx, { status: 'fulfilled', value: { warning: true }, timing })).toEqual('warning');
    });
    it('should warn when an async report is in success and has level key', () => {
        expect(getReportAsyncStatus(ctx, { status: 'fulfilled', value: { level: 'notice' }, timing })).toEqual(
            'notice'
        );
        expect(getReportAsyncStatus(ctx, { status: 'fulfilled', value: { level: 'info' }, timing })).toEqual('info');
    });
    it('should return error when an async report is in rejected', () => {
        expect(getReportAsyncStatus(ctx, { status: 'rejected', reason: 'some error', timing })).toEqual('error');
    });
    it('should return notice when an async report is in rejected with a specific error and the chain is zkevm', () => {
        expect(
            getReportAsyncStatus(
                { ...ctx, chain: 'zkevm' },
                { status: 'rejected', reason: { details: 'failed to execute the unsigned transaction' }, timing }
            )
        ).toEqual('notice');
    });

    it('should return notice when an async report is in rejected with a specific error and the vault is in VAULT_IDS_WITH_A_KNOWN_HARVEST_BUG', () => {
        const localCtx: ReportAsyncStatusContext = {
            ...ctx,
            vault: { id: 'this-vault-has-a-bug' } as any as BeefyVault,
        };
        expect(VAULT_IDS_WITH_A_KNOWN_HARVEST_BUG).toContain(localCtx.vault.id);
        expect(
            getReportAsyncStatus(localCtx, { status: 'rejected', reason: { details: 'This was a mistake' }, timing })
        ).toEqual('notice');
    });
});

describe('mergeReportAsyncStatus', () => {
    it('should return error if one of the status is error', () => {
        expect(mergeReportAsyncStatus('error', 'success')).toEqual('error');
        expect(mergeReportAsyncStatus('success', 'error')).toEqual('error');
        expect(mergeReportAsyncStatus('error', 'warning')).toEqual('error');
        expect(mergeReportAsyncStatus('warning', 'error')).toEqual('error');
        expect(mergeReportAsyncStatus('error', 'notice')).toEqual('error');
        expect(mergeReportAsyncStatus('notice', 'error')).toEqual('error');
        expect(mergeReportAsyncStatus('error', 'info')).toEqual('error');
        expect(mergeReportAsyncStatus('info', 'error')).toEqual('error');
        expect(mergeReportAsyncStatus('error', 'not-started')).toEqual('error');
        expect(mergeReportAsyncStatus('not-started', 'error')).toEqual('error');
    });

    it('should return warning if one of the status is warning but none is in error or silent-error', () => {
        expect(mergeReportAsyncStatus('warning', 'success')).toEqual('warning');
        expect(mergeReportAsyncStatus('success', 'warning')).toEqual('warning');
        expect(mergeReportAsyncStatus('warning', 'notice')).toEqual('warning');
        expect(mergeReportAsyncStatus('notice', 'warning')).toEqual('warning');
        expect(mergeReportAsyncStatus('warning', 'info')).toEqual('warning');
        expect(mergeReportAsyncStatus('info', 'warning')).toEqual('warning');
        expect(mergeReportAsyncStatus('warning', 'not-started')).toEqual('warning');
        expect(mergeReportAsyncStatus('not-started', 'warning')).toEqual('warning');
    });

    it('should return notice if one of the status is notice but none is in error, silent-error or warning', () => {
        expect(mergeReportAsyncStatus('notice', 'success')).toEqual('notice');
        expect(mergeReportAsyncStatus('success', 'notice')).toEqual('notice');
        expect(mergeReportAsyncStatus('notice', 'info')).toEqual('notice');
        expect(mergeReportAsyncStatus('info', 'notice')).toEqual('notice');
        expect(mergeReportAsyncStatus('notice', 'not-started')).toEqual('notice');
        expect(mergeReportAsyncStatus('not-started', 'notice')).toEqual('notice');
    });

    it('should return info if one of the status is info but none is in error, silent-error, warning or notice', () => {
        expect(mergeReportAsyncStatus('info', 'success')).toEqual('info');
        expect(mergeReportAsyncStatus('success', 'info')).toEqual('info');
        expect(mergeReportAsyncStatus('info', 'not-started')).toEqual('info');
        expect(mergeReportAsyncStatus('not-started', 'info')).toEqual('info');
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
    const ctx: ReportAsyncStatusContext = {
        chain: 'ethereum',
        vault: {
            id: 'curve-weth-wsteth',
        } as any as BeefyVault,
    };

    it('should return the status of the worst report', () => {
        expect(
            getMergedReportAsyncStatus<any>(ctx, [
                { status: 'fulfilled', value: { ok: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
            ])
        ).toEqual('warning');
        expect(
            getMergedReportAsyncStatus(ctx, [
                { status: 'fulfilled', value: { ok: true }, timing },
                { status: 'fulfilled', value: { warning: true }, timing },
                { status: 'rejected', reason: 'some error', timing },
                { status: 'fulfilled', value: { warning: true }, timing },
            ])
        ).toEqual('error');
    });
});
