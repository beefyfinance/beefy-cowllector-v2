import { Account, Chain as ViemChain, Client, Transport, Hex } from 'viem';
import { Chain } from '../chain';
import { HarvestParameters, HarvestReturnType, harvest } from './harvest';
import { estimateHarvestCallGasAmount } from './estimateHarvestCallGasAmount';
import { GasEstimationResult } from '../gas';

type CustomHarvestPublicActions<
    TTransport extends Transport = Transport,
    TChain extends ViemChain | undefined = ViemChain | undefined,
    TAccount extends Account | undefined = Account | undefined,
> = {
    estimateHarvestCallGasAmount: ({ strategyAddress }: { strategyAddress: Hex }) => Promise<GasEstimationResult>;
};

export function createCustomHarvestPublicActions({ chain }: { chain: Chain }) {
    return function customHarvestPublicActions<
        TTransport extends Transport = Transport,
        TChain extends ViemChain | undefined = ViemChain | undefined,
        TAccount extends Account | undefined = Account | undefined,
    >(client: Client<TTransport, TChain, TAccount>): CustomHarvestPublicActions<TTransport, TChain, TAccount> {
        return {
            estimateHarvestCallGasAmount: args => estimateHarvestCallGasAmount({ chain }, args),
        };
    };
}

type CustomHarvestWalletActions<
    TTransport extends Transport = Transport,
    TChain extends ViemChain | undefined = ViemChain | undefined,
    TAccount extends Account | undefined = Account | undefined,
> = {
    harvest: ({ strategyAddress }: HarvestParameters) => Promise<HarvestReturnType>;
};

export function createCustomHarvestWalletActions({ chain }: { chain: Chain }) {
    return function customHarvestWalletActions<
        TTransport extends Transport = Transport,
        TChain extends ViemChain | undefined = ViemChain | undefined,
        TAccount extends Account | undefined = Account | undefined,
    >(_: Client<TTransport, TChain, TAccount>): CustomHarvestWalletActions<TTransport, TChain, TAccount> {
        return {
            harvest: args => harvest({ chain }, args),
        };
    };
}
