import { getAddress, type Hex } from 'viem';
import { WETHABI } from '../abi/WETHABI';
import { getChainWNativeTokenAddress } from './addressbook';
import type { Chain } from './chain';
import { getReadOnlyRpcClient, getWalletAccount } from './rpc-client';

export interface CollectorBalance {
    balanceWei: bigint;
    wnativeBalanceWei: bigint;
    aggregatedBalanceWei: bigint;
}

export async function fetchCollectorBalance({
    chain,
    overwriteCowllectorAddress,
}: {
    chain: Chain;
    overwriteCowllectorAddress?: Hex;
}): Promise<CollectorBalance> {
    const publicClient = getReadOnlyRpcClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const wnativeAddress = getChainWNativeTokenAddress(chain);

    const cowllectorAddress = overwriteCowllectorAddress ?? walletAccount.address;

    const [balanceWei, wnativeBalanceWei] = await Promise.all([
        publicClient.getBalance({
            address: cowllectorAddress,
        }),
        publicClient.readContract({
            abi: WETHABI,
            address: wnativeAddress,
            functionName: 'balanceOf',
            args: [getAddress(cowllectorAddress)],
        }),
    ]);
    return {
        balanceWei,
        wnativeBalanceWei,
        aggregatedBalanceWei: balanceWei + wnativeBalanceWei,
    };
}
