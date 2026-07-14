import { addressBook } from '@beefyfinance/blockchain-addressbook';

export type Chain = keyof typeof addressBook;

export const allChainIds: Chain[] = [...Object.keys(addressBook)] as Chain[];
