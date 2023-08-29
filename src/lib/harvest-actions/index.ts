import { Account, Chain as ViemChain, Client, Transport } from 'viem';
import { Chain } from '../chain';
import { HarvestParameters, HarvestReturnType, harvest } from './harvest';

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
