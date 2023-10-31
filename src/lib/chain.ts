import { addressBook } from 'blockchain-addressbook';

export type Chain = keyof typeof addressBook | 'linea' | 'scroll';

export const allChainIds: Chain[] = Object.keys(addressBook).concat(['linea', 'scroll']) as Chain[];
