export const IStrategyABI = [
    {
        inputs: [{ internalType: 'address', name: 'callFeeRecipient', type: 'address' }],
        name: 'harvest',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'harvest',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },

    // error abi to decode in case of error
    {
        inputs: [{ internalType: 'address', name: 'target', type: 'address' }],
        name: 'AddressEmptyCode',
        type: 'error',
    },
    {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'AddressInsufficientBalance',
        type: 'error',
    },
    { inputs: [], name: 'FailedInnerCall', type: 'error' },
    { inputs: [], name: 'InvalidEntry', type: 'error' },
    { inputs: [], name: 'InvalidInput', type: 'error' },
    { inputs: [], name: 'InvalidOutput', type: 'error' },
    { inputs: [], name: 'InvalidTicks', type: 'error' },
    { inputs: [], name: 'NotAuthorized', type: 'error' },
    { inputs: [], name: 'NotCalm', type: 'error' },
    { inputs: [], name: 'NotManager', type: 'error' },
    { inputs: [], name: 'NotPool', type: 'error' },
    { inputs: [], name: 'NotStrategist', type: 'error' },
    { inputs: [], name: 'NotVault', type: 'error' },
    { inputs: [], name: 'OverLimit', type: 'error' },
    {
        inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
        name: 'SafeERC20FailedOperation',
        type: 'error',
    },
    { inputs: [], name: 'StrategyPaused', type: 'error' },
    { inputs: [], name: 'TooMuchSlippage', type: 'error' },
] as const;
