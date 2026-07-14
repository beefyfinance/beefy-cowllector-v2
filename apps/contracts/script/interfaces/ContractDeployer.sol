// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBeefyContractDeployer {
    event ContractDeployed(bytes32 indexed salt, address deploymentAddress);

    // Deploy a contract, if this address matches contract deployer on other chains it should match deployment address if salt/bytecode match.,
    function deploy(bytes32 _salt, bytes memory _bytecode) external returns (address deploymentAddress);
    // Get address by salt and bytecode.
    function getAddress(bytes32 _salt, bytes memory _bytecode) external view returns (address);

    // Creat salt by int or string.
    function createSalt(uint256 _num, string calldata _string) external pure returns (bytes32);
}
