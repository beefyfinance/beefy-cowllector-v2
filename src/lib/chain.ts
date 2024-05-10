import { addressBook } from 'blockchain-addressbook';

export type Chain = keyof typeof addressBook | 'mode' | 'scroll';

export const allChainIds: Chain[] = [...Object.keys(addressBook), 'mode', 'scroll'] as Chain[];
