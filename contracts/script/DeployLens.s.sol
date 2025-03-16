// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IBeefyContractDeployer} from "./interfaces/ContractDeployer.sol";

/**
 * Deploy an L2 token contract
 */
contract DeployLens is Script {
    IBeefyContractDeployer deployer = IBeefyContractDeployer(0xcc536552A6214d6667fBC3EC38965F7f556A6391);
    bytes32 salt = 0xdc291b674a39e606e8cec186d9db6fe137bd4dfd5e5bfc806e20b7506c8dc044;

    function run() public {
        bytes memory args = "";
        bytes memory bytecode = abi.encodePacked(vm.getCode("BeefyHarvestLens.sol:BeefyHarvestLens"), args);

        vm.startBroadcast();

        deployer.deploy(salt, bytecode);

        vm.stopBroadcast();
    }
}
