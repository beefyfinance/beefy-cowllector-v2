import * as addressbook from 'blockchain-addressbook';
import { Chain } from './chain';
import { Hex } from 'viem';

export function getChainWNativeTokenSymbol(chain: Chain): string {
    if (chain === 'linea') return 'ETH';
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}

export function getChainWNativeTokenAddress(chain: Chain): Hex {
    if (chain === 'linea') return '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f';
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.address as Hex;
}

export function getNetworkId(chain: Chain): number {
    if (chain === 'linea') return 59144;
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.chainId;
}
