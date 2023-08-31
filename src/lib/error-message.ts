import { get } from 'lodash';

export function extractErrorMessage(e: any): string {
    const keys = [
        'reason.details',
        'reason.shortMessage',
        'reason.message',
        'shortMessage',
        'message',
        'reason',
        'details',
    ];
    let errorMsg: string | undefined;

    for (const key of keys) {
        errorMsg = get(e, key);
        if (errorMsg) {
            return errorMsg;
        }
    }

    return 'unknown';
}
