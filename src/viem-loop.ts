import { http, createPublicClient } from 'viem';
import { toAccount } from 'viem/accounts';
import { linea } from 'viem/chains';

const WETHABI = [
    {
        constant: true,
        inputs: [{ name: '', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        payable: false,
        stateMutability: 'view',
        type: 'function',
    },
    {
        constant: false,
        inputs: [{ name: 'wad', type: 'uint256' }],
        name: 'withdraw',
        outputs: [],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

const publicClient = createPublicClient({
    chain: linea,
    transport: http(undefined, {
        onFetchRequest: async request => {
            const content = await request.clone().text();
            console.log({ msg: 'rpc.http: request', data: content });
        },
        onFetchResponse: async response => {
            const content = await response.clone().text();
            console.log({ msg: 'rpc.http: response', data: content });
        },
    }),
});

const main = async () => {
    const account = toAccount({
        address: '0x03d9964f4D93a24B58c0Fc3a8Df3474b59Ba8557',
        signMessage: async message => {
            throw new Error('signMessage not implemented');
        },
        signTransaction: async transaction => {
            throw new Error('signTransaction not implemented');
        },
        signTypedData: async typedData => {
            throw new Error('signTypedData not implemented');
        },
    });

    const wnative = '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f';

    const balance = await publicClient.readContract({
        abi: WETHABI,
        address: wnative,
        functionName: 'balanceOf',
        args: [account.address],
    });

    const rawGasEstimation = await publicClient.estimateContractGas({
        abi: WETHABI,
        address: wnative,
        functionName: 'withdraw',
        args: [balance],
        account: account,
    });

    console.log(rawGasEstimation);
};

main();
