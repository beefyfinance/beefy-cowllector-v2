// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import 'forge-std/Test.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../src/BeefyHarvestLens.sol';
import '../src/interfaces/beefy/IStrategyV7.sol';

contract BeefyHarvestLensLiveTest is Test {
    using SafeERC20 for IERC20;

    function test_debug_a_lens_error_on_bsc() public {
        // bsc setup
        IERC20 native = IERC20(address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c));
        //BeefyHarvestLens lens = BeefyHarvestLens(address(0xa9b924a0AaFad0e6aAE25410bc16C205446A11D2));
        vm.createSelectFork("https://rpc.ankr.com/bsc");

        // init lens
        BeefyHarvestLens lens = new BeefyHarvestLens();
        lens.init(native);
        
        IStrategyV7 strategy = IStrategyV7(address(0xFA3CcB086Bf371A2Ff33Db8521Be47c5B4b9d10E));
        (uint256 callReward, bool success, uint256 lastHarvest, bool paused) = lens.harvest(strategy);

        assertEq(success, false);
        assertEq(paused, false);
        assertEq(callReward, 0);
        assertEq(lastHarvest, 0);
    }
}
