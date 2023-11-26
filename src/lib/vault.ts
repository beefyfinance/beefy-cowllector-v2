import { Hex } from 'viem';
import { Chain } from './chain';

export type StrategyTypeId =
    | 'lendingNoBorrow'
    | 'single-lp'
    | 'lp'
    | 'maxi'
    | 'single'
    | 'multi-lp'
    | 'lending'
    | 'gmx-gm'
    | 'managed-conc-lp'
    | 'glp-gmx'
    | 'multi-lp-locked'
    | 'mvlp-mvx'
    | 'mmy-mlp'
    | 'single-syrup'
    | 'olp-opx'
    | 'klp'
    | 'bifi-vault'
    | 'qlp';

export type BeefyVault = {
    id: string;
    eol: boolean;
    chain: Chain;
    strategyAddress: Hex;
    platformId: string;
    tvlUsd: number;
    lastHarvest: Date | null;
    strategyTypeId: StrategyTypeId | null;
};
