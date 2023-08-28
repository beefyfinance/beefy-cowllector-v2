// n * m
export function bigintMultiplyFloat(n: bigint, m: number, precision: number = 4) {
    // round to precision
    const divisor = 10 ** precision;
    const mult = BigInt(Math.round(m * divisor));
    return (n * mult) / BigInt(divisor);
}

export function bigintFormat(n: bigint, decimal: number = 18, precision: number = 18): string {
    const sign = n < 0 ? '-' : '';
    n = n < 0 ? -n : n;
    const div = BigInt(10 ** decimal);
    const decimalPart = (n % div).toString().padStart(decimal, '0').slice(0, precision);
    const integerPart = (n / div).toString();
    return `${sign}${integerPart}.${decimalPart}`;
}
