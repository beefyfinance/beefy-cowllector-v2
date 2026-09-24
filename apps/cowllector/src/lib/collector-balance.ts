import { getAddress, type Hex, parseAbi } from 'viem';
import { WETHABI } from '../abi/WETHABI';
import { getChainWNativeTokenAddress } from './addressbook';
import type { Chain } from './chain';
import { getReadOnlyRpcClient, getWalletAccount } from './rpc-client';

export interface CollectorBalance {
    balanceWei: bigint;
    wnativeBalanceWei: bigint;
    aggregatedBalanceWei: bigint;
}

// Arc: native USDC (18) and ERC-20 USDC/WNATIVE (6) are two views of one balance.
// Summing getBalance + balanceOf double-counts (and mixes decimals).
const SHARED_NATIVE_WNATIVE_BALANCE: Chain[] = ['arc'];

const GET_ETH_BALANCE_ABI = parseAbi(['function getEthBalance(address) view returns (uint256)']);

export async function fetchCollectorBalance({
    chain,
    overwriteCowllectorAddress,
}: {
    chain: Chain;
    overwriteCowllectorAddress?: Hex;
}): Promise<CollectorBalance> {
    const publicClient = getReadOnlyRpcClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const cowllectorAddress = getAddress(overwriteCowllectorAddress ?? walletAccount.address);
    const multicall3 = publicClient.chain.contracts?.multicall3?.address ?? getAddress('0xcA11bde05977b3631167028862bE2a173976CA11');

    const [balanceWei, wnativeBalanceWei] = await publicClient.multicall({
        allowFailure: false,
        multicallAddress: multicall3,
        contracts: [
            {
                address: multicall3,
                abi: GET_ETH_BALANCE_ABI,
                functionName: 'getEthBalance',
                args: [cowllectorAddress],
            },
            {
                address: getChainWNativeTokenAddress(chain),
                abi: WETHABI,
                functionName: 'balanceOf',
                args: [cowllectorAddress],
            },
        ],
    });

    if (SHARED_NATIVE_WNATIVE_BALANCE.includes(chain)) {
        return { balanceWei, wnativeBalanceWei: 0n, aggregatedBalanceWei: balanceWei };
    }

    return {
        balanceWei,
        wnativeBalanceWei,
        aggregatedBalanceWei: balanceWei + wnativeBalanceWei,
    };
}
