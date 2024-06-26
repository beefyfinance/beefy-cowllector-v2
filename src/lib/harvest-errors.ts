import type { Hex } from 'viem';
import type { Chain } from './chain';

export class NotEnoughRemainingGasError extends Error {
    constructor(
        public data: {
            remainingGasWei: bigint;
            transactionCostEstimationWei: bigint;
            strategyAddress: Hex;
            chain: Chain;
        }
    ) {
        super('We expect not to have enough gas to harvest');
        this.name = 'NotEnoughRemainingGasError';
    }
}

export class UnsupportedChainError extends Error {
    constructor(public data: { chain: Chain }) {
        super('Unsupported chain');
        this.name = 'UnsupportedChainError';
    }
}
