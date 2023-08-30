import { Hex } from 'viem';
import { Chain } from './chain';

export type BeefyVault = {
    id: string;
    eol: boolean;
    chain: Chain;
    strategyAddress: Hex;
    platformId: string;
    tvlUsd: number;
};
