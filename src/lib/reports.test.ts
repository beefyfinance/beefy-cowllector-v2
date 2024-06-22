import { CENSOR_SECRETS_FROM_REPORTS } from './config';
import { serializeReport } from './reports';

jest.mock('./config', () => ({
    CENSOR_SECRETS_FROM_REPORTS: [
        'first-secret',
        'second-secret',
        'CaSeInSeNsItIvE-SeCreT',
        'secret with special regex chars [ ] ( ) { } * + ? . \\ ^ $ |',
    ],
    LOG_LEVEL: 'error',
}));

describe('harvest report', () => {
    it('should serialize a report to JSON without crashing', () => {
        const serialized = serializeReport(
            {
                chain: 'bsc',
                timing: {
                    startedAt: new Date('2021-01-01T00:00:00.000Z'),
                    endedAt: new Date('2021-01-01T00:00:00.000Z'),
                    durationMs: 0,
                },
                details: [
                    {
                        vault: {
                            id: 'test',
                        },
                        summary: {
                            error: false,
                            profitWei: 12356610n,
                        },
                        harvestDecision: null,
                    },
                ],
            },
            true
        );
        expect(JSON.parse(serialized)).toEqual({
            chain: 'bsc',
            timing: {
                startedAt: '2021-01-01T00:00:00.000Z',
                endedAt: '2021-01-01T00:00:00.000Z',
                durationMs: 0,
            },
            details: [
                {
                    vault: {
                        id: 'test',
                    },
                    summary: {
                        error: false,
                        profitWei: '12356610',
                    },
                    harvestDecision: null,
                },
            ],
        });
    });

    it('should censor secrets from our report', () => {
        expect(CENSOR_SECRETS_FROM_REPORTS).toContain('first-secret');
        expect(CENSOR_SECRETS_FROM_REPORTS).toContain('second-secret');
        expect(CENSOR_SECRETS_FROM_REPORTS).toContain('CaSeInSeNsItIvE-SeCreT');
        expect(CENSOR_SECRETS_FROM_REPORTS).toContain('secret with special regex chars [ ] ( ) { } * + ? . \\ ^ $ |');

        const serialized = serializeReport({
            chain: 'bsc',
            someObj: {
                'first-secret': {
                    key: 'value',
                },
            },
            someError: JSON.stringify({
                error: 'second-secret',
            }),
            someArray: ['second-secret'],
            someString: 'caseInsensitive-secret',
            anotherString: 'secret with special regex chars [ ] ( ) { } * + ? . \\ ^ $ |',
        });

        expect(serialized).not.toContain('first-secret');
        expect(serialized).not.toContain('second-secret');
        expect(serialized).not.toContain('caseInsensitive-secret');
        expect(serialized).not.toContain('secret with special regex chars [ ] ( ) { } * + ? . \\ ^ $ |');
    });
});
