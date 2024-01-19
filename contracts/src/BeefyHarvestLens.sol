// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/beefy/IStrategyV7.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

struct LensResult {
    uint256 callReward;
    uint256 lastHarvest;
    uint256 gasUsed;
    uint256 blockNumber;
    bool paused;
    bool success;
    bytes harvestResult;
}

error CallRewardTooLow(uint256 callReward, uint256 minCallReward);
error StrategyPaused();
error MinCallRewardTooLow(uint256 minCallReward);

// Simulate a harvest while recieving a call reward. Return callReward amount and whether or not it was a success.
contract BeefyHarvestLens {
    using SafeERC20 for IERC20;

    // Simulate harvest calling callStatic/simulateContract for return results.
    // this method will hide any harvest errors and it is not recommended to use it to do the harvesting
    // only the simulation using callStatic/simulateContract is recommended
    function harvestSimulation(IStrategyV7 _strategy, IERC20 _rewardToken) external returns (LensResult memory res) {
        res.blockNumber = block.number;
        res.paused = _strategy.paused();

        // some strategies don't have lastHarvest
        try _strategy.lastHarvest() returns (uint256 _lastHarvest) {
            res.lastHarvest = _lastHarvest;
        } catch {}

        if (!res.paused) {
            uint256 rewardsBefore = IERC20(_rewardToken).balanceOf(address(this));
            uint256 gasBefore = gasleft();
            (bool _success, bytes memory _harvestResult) =
                address(_strategy).call(abi.encodeWithSignature("harvest(address)", address(this)));
            uint256 gasAfter = gasleft();
            res.success = _success;
            res.harvestResult = _harvestResult;

            if (res.success) {
                res.callReward = IERC20(_rewardToken).balanceOf(address(this)) - rewardsBefore;
                res.gasUsed = gasBefore - gasAfter;

                // protection in case someone actually uses this contract to harvest despite our warnings
                if (res.callReward > 0) {
                    _rewardToken.safeTransfer(msg.sender, res.callReward);
                }
            }
        }
    }

    function safeHarvest(IStrategyV7 _strategy, IERC20 _rewardToken, uint256 _minCallReward)
        external
        returns (uint256)
    {
        if (_strategy.paused()) {
            revert StrategyPaused();
        }

        if (_minCallReward == 0) {
            revert MinCallRewardTooLow({minCallReward: _minCallReward});
        }

        uint256 rewardsBefore = IERC20(_rewardToken).balanceOf(address(this));
        IStrategyV7(_strategy).harvest(address(this));

        // ensure we are not getting sandwiched by a flash loan
        uint256 callReward = IERC20(_rewardToken).balanceOf(address(this)) - rewardsBefore;
        if (callReward < _minCallReward) {
            revert CallRewardTooLow({callReward: callReward, minCallReward: _minCallReward});
        }

        _rewardToken.safeTransfer(msg.sender, callReward);

        return callReward;
    }
}
