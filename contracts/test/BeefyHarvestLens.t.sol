// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../src/BeefyHarvestLens.sol";
import "../src/interfaces/beefy/IStrategyV7.sol";
import "../src/interfaces/wnative/IWETH.sol";
import "./mocks/StrategyV7Mock.sol";
import "./mocks/IWETHMock.sol";

contract BeefyHarvestLensTest is Test {
    using SafeERC20 for IERC20;

    IWETH wnative;
    uint256 lastHarvestMock;
    bool pausedMock;
    uint256 harvestLoops;
    bool revertOnHarvest;
    bool revertOnLastHarvest;
    uint256 harvestRewards;
    uint256 thisBalance;

    function setUp() public {
        wnative = IWETH(new IWETHMock());
        lastHarvestMock = 123456;
        pausedMock = false;
        harvestLoops = 10;
        revertOnHarvest = false;
        revertOnLastHarvest = false;
        harvestRewards = 987654;
    }

    // Allow this contract to recieve ETH from the harvest lens
    receive() external payable {} // Function to receive Ether. msg.data must be empty
    fallback() external payable {} // Fallback function is called when msg.data is not empty

    function _helperCreateContracts() private returns (IStrategyV7 strat, BeefyHarvestLens lens) {
        strat = IStrategyV7(
            address(
                new StrategyV7Mock(wnative, lastHarvestMock, pausedMock, harvestLoops, revertOnHarvest, revertOnLastHarvest, harvestRewards)
            )
        );
        // mint some weth
        uint256 amount = 10 ether;
        (bool success,) = address(wnative).call{value: amount}("");
        require(success, "wrapping failed");
        require(wnative.balanceOf(address(this)) == amount, "wrong weth balance");

        // send all weth to the strategy
        success = wnative.transfer(address(strat), amount);
        require(success, "transfer weth to strat failed");
        require(wnative.balanceOf(address(strat)) == amount, "wrong weth balance");

        lens = new BeefyHarvestLens();
        lens.init(wnative);

        emit log_named_uint("test eth balance", address(this).balance);
        emit log_named_uint("strat eth balance", address(strat).balance);
        emit log_named_uint("strat weth balance", wnative.balanceOf(address(strat)));
        emit log_named_uint("lens eth balance", address(lens).balance);
        emit log_named_uint("lens weth balance", wnative.balanceOf(address(lens)));

        // save this balance for later
        thisBalance = address(this).balance;
    }

    function test_lens_do_not_throw_when_harvest_reverts() public {
        revertOnHarvest = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, true);

        assertEq(res.callReward, 0, "callReward");
        assertFalse(res.success, "success");
        assertEq(res.lastHarvest, 123456, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 0, "eth balance");
    }

    function test_lens_should_throw_when_catch_harvest_errors_is_false() public {
        revertOnHarvest = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();

        vm.expectRevert(MockHarvestError.selector);
        LensResult memory res = lens.harvest(strat, false);

        assertFalse(res.success, "success");
    }

    function test_normal_harvest_with_capture() public {
        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, true);

        assertEq(res.callReward, 987654, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 123456, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 987654, "eth balance");
    }

    function test_normal_harvest_no_capture() public {
        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, false);

        assertEq(res.callReward, 987654, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 123456, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 987654, "eth balance");
    }

    function test_lens_returns_call_rewards_with_capture() public {
        harvestRewards = 1 ether;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, true);

        assertEq(res.callReward, 1 ether, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 123456, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 1 ether, "eth balance");
    }

    function test_lens_returns_call_rewards_no_capture() public {
        harvestRewards = 1 ether;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, false);

        assertEq(res.callReward, 1 ether, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 123456, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 1 ether, "eth balance");
    }

    function test_lens_returns_paused_with_capture() public {
        pausedMock = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, true);

        assertEq(res.callReward, 0, "callReward");
        assertFalse(res.success, "success");
        assertEq(res.lastHarvest, 0, "lastHarvest");
        assertTrue(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 0, "eth balance");
    }

    function test_lens_returns_paused_no_capture() public {
        pausedMock = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, false);

        assertEq(res.callReward, 0, "callReward");
        assertFalse(res.success, "success");
        assertEq(res.lastHarvest, 0, "lastHarvest");
        assertTrue(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 0, "eth balance");
    }

    function test_lens_returns_last_harvest_with_capture() public {
        lastHarvestMock = 98765;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, true);

        assertEq(res.callReward, 987654, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 98765, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 987654, "eth balance");
    }

    function test_lens_returns_last_harvest_no_capture() public {
        lastHarvestMock = 98765;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, false);

        assertEq(res.callReward, 987654, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 98765, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 987654, "eth balance");
    }

    function test_lens_success_when_call_reward_is_zero_with_capture() public {
        harvestRewards = 0;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, true);

        assertEq(res.callReward, 0, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 123456, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 0, "eth balance");
    }

    function test_lens_success_when_call_reward_is_zero_no_capture() public {
        harvestRewards = 0;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, false);

        assertEq(res.callReward, 0, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 123456, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 0, "eth balance");
    }

    function test_lens_do_not_crash_when_last_harvest_isnt_defined_with_capture() public {
        revertOnLastHarvest = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, true);

        assertEq(res.callReward, 987654, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 0, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 987654, "eth balance");
    }

    function test_lens_do_not_crash_when_last_harvest_isnt_defined_no_capture() public {
        revertOnLastHarvest = true;

        (IStrategyV7 strat, BeefyHarvestLens lens) = _helperCreateContracts();
        LensResult memory res = lens.harvest(strat, false);

        assertEq(res.callReward, 987654, "callReward");
        assertTrue(res.success, "success");
        assertEq(res.lastHarvest, 0, "lastHarvest");
        assertFalse(res.paused, "paused");
        assertEq(address(this).balance - thisBalance, 987654, "eth balance");
    }
}
