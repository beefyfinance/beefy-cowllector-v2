import type { Account, Client, Transport, Chain as ViemChain } from 'viem';
import type { Chain } from '../chain';
import { type HarvestParameters, type HarvestReturnType, harvest } from './harvest';

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
