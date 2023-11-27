import * as addressbook from 'blockchain-addressbook';
import { Chain } from './chain';
import { Hex } from 'viem';

export function getChainWNativeTokenSymbol(chain: Chain): string {
    if (chain === 'linea') return 'ETH';
    if (chain === 'scroll') return 'ETH';
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}

export function getChainWNativeTokenAddress(chain: Chain): Hex {
    if (chain === 'linea') return '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f';
    if (chain === 'scroll') return '0x5300000000000000000000000000000000000004';
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.address as Hex;
}

export function getNetworkId(chain: Chain): number {
    if (chain === 'linea') return 59144;
    if (chain === 'scroll') return 534352;
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.chainId;
}
