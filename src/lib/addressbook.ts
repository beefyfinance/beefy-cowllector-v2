import * as addressbook from 'blockchain-addressbook';
import { Chain } from './chain';
import { Hex } from 'viem';

export function getChainWNativeTokenSymbol(chain: Chain): string {
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}

export function getChainWNativeTokenAddress(chain: Chain): Hex {
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.address as Hex;
}

export function getNetworkId(chain: Chain): number {
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.chainId;
}
