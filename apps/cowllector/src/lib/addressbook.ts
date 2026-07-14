import { addressBook } from '@beefyfinance/blockchain-addressbook';
import type { Hex } from 'viem';
import type { Chain } from './chain';

export function getChainNativeSymbol(chain: Chain): string {
    return addressBook[chain].native.symbol;
}

export function getChainWNativeTokenSymbol(chain: Chain): string {
    const tokens = addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}

export function getChainWNativeTokenAddress(chain: Chain): Hex {
    const tokens = addressBook[chain].tokens;
    return tokens.WNATIVE.address as Hex;
}

export function getChainFeesTokenDecimals(chain: Chain): number {
    const tokens = addressBook[chain].tokens;
    return tokens.FEES.decimals;
}

export function getChainFeesTokenAddress(chain: Chain): Hex {
    const tokens = addressBook[chain].tokens;
    return tokens.FEES.address as Hex;
}
