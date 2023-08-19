import * as addressbook from 'blockchain-addressbook';
import { Chain } from './chain';

export function getChainWNativeTokenSymbol(chain: Chain): string {
    const tokens = addressbook.addressBook[chain].tokens;
    return tokens.WNATIVE.symbol;
}
