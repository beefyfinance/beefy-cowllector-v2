import { addressBook } from 'blockchain-addressbook';

export type Chain = keyof typeof addressBook | 'mode';

export const allChainIds: Chain[] = [...Object.keys(addressBook), 'mode'] as Chain[];
