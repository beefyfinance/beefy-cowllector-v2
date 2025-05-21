import * as addressbook from 'blockchain-addressbook';
import type { Hex } from 'viem';
import type { Chain } from './chain';

export function getChainNativeSymbol(chain: Chain): string {
  return addressbook.addressBook[chain].native.symbol;
}

export function getChainWNativeTokenDecimals(chain: Chain): number {
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.decimals;
}

export function getChainWNativeTokenSymbol(chain: Chain): string {
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}

export function getChainWNativeTokenAddress(chain: Chain): Hex {
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.address as Hex;
}

export function getChainFeesTokenDecimals(chain: Chain): number {
  const tokens = addressbook.addressBook[chain].tokens;
  return tokens.FEES.decimals;
}

export function getChainFeesTokenSymbol(chain: Chain): string {
  const tokens = addressbook.addressBook[chain].tokens;
  return tokens.FEES.symbol;
}

export function getChainFeesTokenAddress(chain: Chain): Hex {
  const tokens = addressbook.addressBook[chain].tokens;
  return tokens.FEES.address as Hex;
}
