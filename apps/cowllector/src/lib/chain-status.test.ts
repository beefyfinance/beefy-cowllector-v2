import axios from 'axios';
import { getBeefyChainApiStatuses, isChainEol } from './chain-status';
import { RPC_CONFIG } from './config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('isChainEol', () => {
    it('is eol when the api status is not active', () => {
        expect(isChainEol('ethereum', { ethereum: 'eol' })).toBe(true);
        expect(isChainEol('ethereum', { ethereum: 'paused' })).toBe(true);
        expect(isChainEol('sonic', { sonic: 'eol' })).toBe(true);
    });

    it('is eol when the chain is missing from the api', () => {
        expect(isChainEol('ethereum', {})).toBe(true);
        expect(isChainEol('rootstock', { ethereum: 'active' })).toBe(true);
    });

    it('is eol when local config says eol even if the api says active', () => {
        expect(RPC_CONFIG.linea.eol).toBe(true);
        expect(isChainEol('linea', { linea: 'active' })).toBe(true);
    });

    it('is not eol only when the api says active and local config does not', () => {
        expect(RPC_CONFIG.ethereum.eol).toBe(false);
        expect(isChainEol('ethereum', { ethereum: 'active' })).toBe(false);
    });

    it('uses only local config when the api request failed', () => {
        expect(RPC_CONFIG.ethereum.eol).toBe(false);
        expect(RPC_CONFIG.linea.eol).toBe(true);
        expect(isChainEol('ethereum', null)).toBe(false);
        expect(isChainEol('linea', null)).toBe(true);
    });
});

describe('getBeefyChainApiStatuses', () => {
    it('returns api statuses when the request succeeds', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                ethereum: { id: 'ethereum', status: 'active' },
                sonic: { id: 'sonic', status: 'eol' },
            },
        });

        const statuses = await getBeefyChainApiStatuses();

        expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/chains?'));
        expect(statuses).toEqual({
            ethereum: 'active',
            sonic: 'eol',
        });
        expect(isChainEol('ethereum', statuses)).toBe(false);
        expect(isChainEol('sonic', statuses)).toBe(true);
        expect(isChainEol('berachain', statuses)).toBe(true);
    });

    it('returns null when the api request fails', async () => {
        mockedAxios.get.mockRejectedValueOnce(new Error('network down'));

        await expect(getBeefyChainApiStatuses()).resolves.toBeNull();
    });
});
