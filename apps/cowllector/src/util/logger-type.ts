// this file has to be separated because config.ts imports LogLevels and logger.ts imports LOG_LEVEL from config.ts
export type LogLevels = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export const allLogLevels: LogLevels[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
