export const BeefyHarvestLensV3ABI = [
    {
        inputs: [
            { internalType: 'contract IStrategyV7', name: '_strategy', type: 'address' },
            { internalType: 'contract IERC20', name: '_rewardToken', type: 'address' },
        ],
        name: 'harvest',
        outputs: [
            {
                components: [
                    { internalType: 'uint256', name: 'callReward', type: 'uint256' },
                    { internalType: 'uint256', name: 'lastHarvest', type: 'uint256' },
                    { internalType: 'uint256', name: 'gasUsed', type: 'uint256' },
                    { internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
                    { internalType: 'int8', name: 'isCalmBeforeHarvest', type: 'int8' },
                    { internalType: 'bool', name: 'paused', type: 'bool' },
                    { internalType: 'bool', name: 'success', type: 'bool' },
                    { internalType: 'bytes', name: 'harvestResult', type: 'bytes' },
                ],
                internalType: 'struct LensResult',
                name: 'res',
                type: 'tuple',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'contract IStrategyV7', name: '_strategy', type: 'address' },
            { internalType: 'contract IERC20', name: '_rewardToken', type: 'address' },
        ],
        name: 'harvestNoParams',
        outputs: [
            {
                components: [
                    { internalType: 'uint256', name: 'callReward', type: 'uint256' },
                    { internalType: 'uint256', name: 'lastHarvest', type: 'uint256' },
                    { internalType: 'uint256', name: 'gasUsed', type: 'uint256' },
                    { internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
                    { internalType: 'int8', name: 'isCalmBeforeHarvest', type: 'int8' },
                    { internalType: 'bool', name: 'paused', type: 'bool' },
                    { internalType: 'bool', name: 'success', type: 'bool' },
                    { internalType: 'bytes', name: 'harvestResult', type: 'bytes' },
                ],
                internalType: 'struct LensResult',
                name: 'res',
                type: 'tuple',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'contract IStrategyV7', name: '_strategy', type: 'address' },
            { internalType: 'contract IERC20', name: '_rewardToken', type: 'address' },
            { internalType: 'bytes', name: '_calldata', type: 'bytes' },
        ],
        name: 'harvestWithCalldata',
        outputs: [
            {
                components: [
                    { internalType: 'uint256', name: 'callReward', type: 'uint256' },
                    { internalType: 'uint256', name: 'lastHarvest', type: 'uint256' },
                    { internalType: 'uint256', name: 'gasUsed', type: 'uint256' },
                    { internalType: 'uint256', name: 'blockNumber', type: 'uint256' },
                    { internalType: 'int8', name: 'isCalmBeforeHarvest', type: 'int8' },
                    { internalType: 'bool', name: 'paused', type: 'bool' },
                    { internalType: 'bool', name: 'success', type: 'bool' },
                    { internalType: 'bytes', name: 'harvestResult', type: 'bytes' },
                ],
                internalType: 'struct LensResult',
                name: 'res',
                type: 'tuple',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;
