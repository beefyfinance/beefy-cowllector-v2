import { bigintFormat, bigintMultiplyFloat, floatToBigint } from './bigint';

describe('bigintPercent', () => {
    it('should calculate simple percent', () => {
        expect(bigintMultiplyFloat(100n, 0.1)).toBe(10n);
    });
    it('should calculate more than 100%', () => {
        expect(bigintMultiplyFloat(100n, 1.1)).toBe(110n);
    });
    it('should round to precision', () => {
        expect(bigintMultiplyFloat(100n, 0.123456789, 2)).toBe(12n);
    });
    it('should round to more precision', () => {
        expect(bigintMultiplyFloat(100n, 0.123456789, 4)).toBe(12n);
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
    it('should account for the desired precision', () => {
        expect(bigintFormat(123456789n, 4, 2)).toBe('12345.67');
    });
});

describe('floatToBigint', () => {
    it('should convert a float to a bigint', () => {
        expect(floatToBigint(1.23456789).toString()).toBe('1234567890000000000');
    });
    it('should convert a float to a bigint with decimal 4', () => {
        expect(floatToBigint(1.23456789, 4).toString()).toBe('12346');
    });
    it('should convert a float to a bigint with decimal 2', () => {
        expect(floatToBigint(1.23456789, 2).toString()).toBe('123');
    });
    it('should convert a float to a bigint with decimal 10', () => {
        expect(floatToBigint(1.23456789, 10).toString()).toBe('12345678900');
    });
    it('should convert a float to a bigint with decimal 18', () => {
        expect(floatToBigint(1.23456789, 18).toString()).toBe('1234567890000000000');
    });
    it('should convert an actual very small value', () => {
        expect(floatToBigint(0.04, 18).toString()).toBe('40000000000000000');
    });
});
