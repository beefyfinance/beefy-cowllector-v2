import { WETHABI } from '../abi/WETHABI';
import { getChainWNativeTokenAddress } from './addressbook';
import { Chain } from './chain';
import { getReadOnlyRpcClient, getWalletAccount } from './rpc-client';

export interface CollectorBalance {
    balanceWei: bigint;
    wnativeBalanceWei: bigint;
    aggregatedBalanceWei: bigint;
}

export async function fetchCollectorBalance({ chain }: { chain: Chain }): Promise<CollectorBalance> {
    const publicClient = getReadOnlyRpcClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const wnativeAddress = getChainWNativeTokenAddress(chain);

    const [balanceWei, wnativeBalanceWei] = await Promise.all([
        publicClient.getBalance({ address: walletAccount.address }),
        publicClient.readContract({
            abi: WETHABI,
            address: wnativeAddress,
            functionName: 'balanceOf',
            args: [walletAccount.address],
        }),
    ]);
    return { balanceWei, wnativeBalanceWei, aggregatedBalanceWei: balanceWei + wnativeBalanceWei };
}
