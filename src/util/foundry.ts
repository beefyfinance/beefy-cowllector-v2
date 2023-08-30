import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rootLogger } from './logger';
import { Hex } from 'viem';
import { Chain } from '../lib/chain';
import { EXPLORER_CONFIG } from '../lib/config';
import { getNetworkId } from '../lib/addressbook';

const execAsync = promisify(exec);

const logger = rootLogger.child({ module: 'foundry' });

const DEFAULT_FOUNDRY_PROFILE = 'gas-optimize';

export async function getFoundryContractOptimizedBytecode(
    contractName: string,
    foundryProfile: string = DEFAULT_FOUNDRY_PROFILE
): Promise<Hex> {
    logger.info({ msg: 'Building contract', data: { contractName, foundryProfile } });
    const res = await execAsync(
        `FOUNDRY_PROFILE=${foundryProfile} forge build --extra-output evm.bytecode.object --extra-output-files evm.bytecode.object`
    );
    if (res.stderr) {
        throw new Error(`Failed to build ${contractName}: ${res.stderr}`);
    } else if (res.stdout) {
        logger.info(res.stdout);
    }

    const bytecodeLocation = `${path.dirname(__filename)}/../../contracts/out/${contractName}.sol/${contractName}.bin`;
    if (!fs.existsSync(bytecodeLocation)) {
        throw new Error(`Failed to find bytecode at ${bytecodeLocation}`);
    }

    const bytecode = await fs.promises.readFile(bytecodeLocation, 'utf8');
    return ('0x' + bytecode) as Hex;
}

export async function verifyFoundryContractForExplorer({
    contractAddress,
    contractName,
    chain,
    foundryProfile = DEFAULT_FOUNDRY_PROFILE,
}: {
    contractName: string;
    contractAddress: Hex;
    chain: Chain;
    foundryProfile?: string;
}) {
    const explorerConfig = EXPLORER_CONFIG[chain];
    const networkId = getNetworkId(chain);
    const optimizerRuns = 1_000_000; // TODO: pull this from the foundry profile config

    const cmdOpts = [
        `--chain-id ${networkId}`,
        `--num-of-optimizations ${optimizerRuns}`,
        `--verifier ${explorerConfig.type}`,
        `--verifier-url '${explorerConfig.apiUrl}'`,
        explorerConfig.type === 'etherscan' ? `--etherscan-api-key '${explorerConfig.apiKey}'` : null,
        `--watch ${contractAddress}`,
        contractName,
    ]
        .filter(Boolean)
        .join(' ');

    const cmd = `FOUNDRY_PROFILE=${foundryProfile} forge verify-contract ${cmdOpts}`;

    const res = await execAsync(cmd);
    if (res.stderr) {
        throw new Error(`Failed to verify ${contractName}: ${res.stderr}`);
    }
    logger.info(res.stdout);
}
