import axios from 'axios';
import { allChainIds } from './chain';
import { getEolByChain, getEolByChainFromApiStatuses } from './chain-status';
import { RPC_CONFIG } from './config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('getEolByChainFromApiStatuses', () => {
    it('treats only status active as not eol', () => {
        const eolByChain = getEolByChainFromApiStatuses({
            ethereum: 'active',
            bsc: 'eol',
            sonic: 'eol',
            linea: 'paused',
        });

        expect(eolByChain.ethereum).toBe(false);
        expect(eolByChain.bsc).toBe(true);
        expect(eolByChain.sonic).toBe(true);
        expect(eolByChain.linea).toBe(true);
    });

    it('treats chains missing from the api as eol', () => {
        const eolByChain = getEolByChainFromApiStatuses({ ethereum: 'active' });

        expect(eolByChain.ethereum).toBe(false);
        expect(eolByChain.polygon).toBe(true);
        expect(eolByChain.rootstock).toBe(true);
    });

    it('covers every known chain', () => {
        const eolByChain = getEolByChainFromApiStatuses({});
        expect(Object.keys(eolByChain).sort()).toEqual([...allChainIds].sort());
        expect(allChainIds.every((chain) => eolByChain[chain] === true)).toBe(true);
    });
});

describe('getEolByChain', () => {
    it('uses api statuses when the request succeeds', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                ethereum: { id: 'ethereum', status: 'active' },
                sonic: { id: 'sonic', status: 'eol' },
            },
        });

        const eolByChain = await getEolByChain();

        expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/chains?'));
        expect(eolByChain.ethereum).toBe(false);
        expect(eolByChain.sonic).toBe(true);
        expect(eolByChain.berachain).toBe(true);
    });

    it('falls back to local config when the api request fails', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('network down'));

        const eolByChain = await getEolByChain();

        for (const chain of allChainIds) {
            expect(eolByChain[chain]).toBe(RPC_CONFIG[chain].eol);
        }
    });
});
