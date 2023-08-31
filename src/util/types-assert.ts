// https://stackoverflow.com/a/53808212/2523414
// a type for testing if two types are equal
export type IfEquals<T, U, Y = unknown, N = never> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2
    ? Y
    : N;
