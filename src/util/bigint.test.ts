import { bigintFormat, bigintPercent } from './bigint';

describe('bigintPercent', () => {
    it('should calculate simple percent', () => {
        expect(bigintPercent(100n, 0.1)).toBe(10n);
    });
    it('should calculate more than 100%', () => {
        expect(bigintPercent(100n, 1.1)).toBe(110n);
    });
    it('should round to precision', () => {
        expect(bigintPercent(100n, 0.123456789, 2)).toBe(12n);
    });
    it('should round to more precision', () => {
        expect(bigintPercent(100n, 0.123456789, 4)).toBe(12n);
    });
});

describe('bigintFormat', () => {
    it('should format a bigint according to required decimal', () => {
        expect(bigintFormat(123456789n, 4)).toBe('12345.6789');
    });
    it('should format a bigint according to required decimal', () => {
        expect(bigintFormat(123456789n, 2)).toBe('1234567.89');
    });
    it('should format a negative bigint according to required decimal', () => {
        expect(bigintFormat(-123456789n, 2)).toBe('-1234567.89');
    });
    it('should format a small number with a large amount of decimals', () => {
        expect(bigintFormat(123n, 10)).toBe('0.0000000123');
    });
});
