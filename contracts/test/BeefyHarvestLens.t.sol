// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../src/BeefyHarvestLens.sol";
import "../src/interfaces/beefy/IStrategyV7.sol";
import "./mocks/StrategyV7Mock.sol";
import "./mocks/ERC20Mock.sol";

contract BeefyHarvestLensTest is Test {
    using SafeERC20 for IERC20;

    IERC20 rewardToken;
    uint256 lastHarvestMock;
    bool pausedMock;
    uint256 harvestLoops;
    bool revertOnHarvest;
    bool revertOnLastHarvest;
    uint256 harvestRewards;

    function setUp() public {
        rewardToken = IERC20(new ERC20Mock(1000 ether));
        lastHarvestMock = 123456;
        pausedMock = false;
        harvestLoops = 10;
        revertOnHarvest = false;
        revertOnLastHarvest = false;
        harvestRewards = 987654;
    }

    function _helper_create_contracts() private returns (IStrategyV7 strat, BeefyHarvestLens lens) {
        strat = IStrategyV7(
            address(
                new StrategyV7Mock(
                    rewardToken,
                    lastHarvestMock,
                    pausedMock,
                    harvestLoops,
                    revertOnHarvest,
                    revertOnLastHarvest,
                    harvestRewards
                )
            )
        );
        rewardToken.safeTransfer(address(strat), 1000 ether);
        lens = new BeefyHarvestLens();
    }

    function test_lens_do_not_throw_when_harvest_reverts() public {
        revertOnHarvest = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helper_create_contracts();
        LensResult memory res = lens.harvest(strat, rewardToken);

        assertEq(res.callReward, 0);
        assertEq(res.success, false);
        assertEq(res.lastHarvest, 123456);
        assertEq(res.paused, false);
        assertEq(res.gasUsed, 0);
        assertEq(res.blockNumber, block.number);
        assertEq(res.harvestResult, abi.encodeWithSignature("Error(string)", "revertOnHarvest"));
        assertEq(rewardToken.balanceOf(address(this)), 0);
    }

    function test_normal_harvest() public {
        (IStrategyV7 strat, BeefyHarvestLens lens) = _helper_create_contracts();
        LensResult memory res = lens.harvest(strat, rewardToken);

        assertEq(res.callReward, 987654);
        assertEq(res.success, true);
        assertEq(res.lastHarvest, 123456);
        assertEq(res.paused, false);
        assertGt(res.gasUsed, 20000);
        assertLt(res.gasUsed, 40000);
        assertEq(res.blockNumber, block.number);
        assertEq(res.harvestResult.length, 0);
        assertEq(rewardToken.balanceOf(address(this)), 987654);
    }

    function test_lens_returns_call_rewards() public {
        harvestRewards = 1 ether;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helper_create_contracts();
        LensResult memory res = lens.harvest(strat, rewardToken);

        assertEq(res.callReward, 1 ether);
        assertEq(res.success, true);
        assertEq(res.lastHarvest, 123456);
        assertEq(res.paused, false);
        assertGt(res.gasUsed, 20000);
        assertLt(res.gasUsed, 40000);
        assertEq(res.blockNumber, block.number);
        assertEq(res.harvestResult.length, 0);
        assertEq(rewardToken.balanceOf(address(this)), 1 ether);
    }

    function test_lens_returns_paused() public {
        pausedMock = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helper_create_contracts();
        LensResult memory res = lens.harvest(strat, rewardToken);

        assertEq(res.callReward, 0);
        assertEq(res.success, false);
        assertEq(res.lastHarvest, 123456);
        assertEq(res.paused, true);
        assertEq(res.gasUsed, 0);
        assertEq(res.blockNumber, block.number);
        assertEq(res.harvestResult.length, 0);
        assertEq(rewardToken.balanceOf(address(this)), 0);
    }

    function test_lens_returns_last_harvest() public {
        lastHarvestMock = 98765;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helper_create_contracts();
        LensResult memory res = lens.harvest(strat, rewardToken);

        assertEq(res.callReward, 987654);
        assertEq(res.success, true);
        assertEq(res.lastHarvest, 98765);
        assertEq(res.paused, false);
        assertGt(res.gasUsed, 20000);
        assertLt(res.gasUsed, 40000);
        assertEq(res.blockNumber, block.number);
        assertEq(res.harvestResult.length, 0);
        assertEq(rewardToken.balanceOf(address(this)), 987654);
    }

    function test_lens_success_when_call_reward_is_zero() public {
        harvestRewards = 0;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helper_create_contracts();
        LensResult memory res = lens.harvest(strat, rewardToken);

        assertEq(res.callReward, 0);
        assertEq(res.success, true);
        assertEq(res.lastHarvest, 123456);
        assertEq(res.paused, false);
        assertGt(res.gasUsed, 1000);
        assertLt(res.gasUsed, 20000);
        assertEq(res.blockNumber, block.number);
        assertEq(res.harvestResult.length, 0);
        assertEq(rewardToken.balanceOf(address(this)), 0);
    }

    function test_lens_do_not_crash_when_last_harvest_isnt_defined() public {
        revertOnLastHarvest = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helper_create_contracts();
        LensResult memory res = lens.harvest(strat, rewardToken);

        assertEq(res.callReward, 987654);
        assertEq(res.success, true);
        assertEq(res.lastHarvest, 0);
        assertEq(res.paused, false);
        assertGt(res.gasUsed, 20000);
        assertLt(res.gasUsed, 40000);
        assertEq(res.blockNumber, block.number);
        assertEq(res.harvestResult.length, 0);
        assertEq(rewardToken.balanceOf(address(this)), 987654);
    }
}
