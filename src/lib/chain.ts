import { addressBook } from 'blockchain-addressbook';

export type Chain = keyof typeof addressBook | 'linea';

export const allChainIds: Chain[] = [...Object.keys(addressBook), 'linea'] as Chain[];
