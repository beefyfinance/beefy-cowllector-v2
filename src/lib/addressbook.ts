import * as addressbook from 'blockchain-addressbook';
import type { Hex } from 'viem';
import type { Chain } from './chain';

export function getChainWNativeTokenDecimals(chain: Chain): number {
    // if (chain === 'abc') {
    //     return 18;
    // }

    if (chain === 'sonic') {
        return 18;
    }

    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.decimals;
}

export function getChainWNativeTokenSymbol(chain: Chain): string {
    // if (chain === 'abc') {
    //     return 'ETH';
    // }

    if (chain === 'sonic') {
        return 'S';
    }

    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}

export function getChainWNativeTokenAddress(chain: Chain): Hex {
    // if (chain === 'abc') {
    //     return '0x0000000000000000000000000000000000000000';
    // }

    if (chain === 'sonic') {
        return '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38';
    }

    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.address as Hex;
}

export function getNetworkId(chain: Chain): number {
    // if (chain === 'abc') {
    //     return 123;
    // }

    if (chain === 'sonic') {
        return 146;
    }

    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.chainId;
}
