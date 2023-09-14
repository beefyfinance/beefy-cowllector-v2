// all those are from viem

/**
 * @description Combines members of an intersection into a readable type.
 *
 * @see {@link https://twitter.com/mattpocockuk/status/1622730173446557697?s=20&t=NdpAcmEFXY01xkqU3KO0Mg}
 * @example
 * Prettify<{ a: string } & { b: string } & { c: number, d: bigint }>
 * => { a: string, b: string, c: number, d: bigint }
 */
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

/**
 * @description Creates a type with required keys K from T.
 *
 * @example
 * type Result = RequiredBy<{ a?: string, b?: number, c: number }, 'a' | 'c'>
 * //   ^? { a: string, b?: number, c: number }
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
