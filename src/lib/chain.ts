import { addressBook } from 'blockchain-addressbook';

export type Chain = keyof typeof addressBook | 'sonic';

export const allChainIds: Chain[] = [...Object.keys(addressBook), 'sonic'] as Chain[];
