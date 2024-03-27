import { addressBook } from 'blockchain-addressbook';

export type Chain = keyof typeof addressBook | 'fraxtal';

export const allChainIds: Chain[] = [...Object.keys(addressBook), 'fraxtal'] as Chain[];
