// n * m
export function bigintMultiplyFloat(n: bigint, m: number, precision = 4) {
    // round to precision
    const divisor = 10 ** precision;
    const mult = BigInt(Math.round(m * divisor));
    return (n * mult) / BigInt(divisor);
}

export function bigintFormat(_n: bigint, decimal = 18, precision = 18): string {
    let n = _n;
    const sign = n < 0 ? '-' : '';
    n = n < 0 ? -n : n;
    const div = BigInt(10 ** decimal);
    const decimalPart = (n % div).toString().padStart(decimal, '0').slice(0, precision);
    const integerPart = (n / div).toString();
    return `${sign}${integerPart}.${decimalPart}`;
}

export function floatToBigint(n: number, decimal = 18): bigint {
    return BigInt(Math.round(n * 10 ** decimal));
}
