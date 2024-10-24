import * as addressbook from 'blockchain-addressbook';
import type { Hex } from 'viem';
import type { Chain } from './chain';

export function getChainWNativeTokenDecimals(chain: Chain): number {
    // if (chain === 'abc') {
    //     return 18;
    // }
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.decimals;
}

export function getChainWNativeTokenSymbol(chain: Chain): string {
    // if (chain === 'abc') {
    //     return 'ETH';
    // }
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}

export function getChainWNativeTokenAddress(chain: Chain): Hex {
    // if (chain === 'abc') {
    //     return '0x0000000000000000000000000000000000000000';
    // }
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.address as Hex;
}

export function getNetworkId(chain: Chain): number {
    // if (chain === 'abc') {
    //     return 123;
    // }
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.chainId;
}
