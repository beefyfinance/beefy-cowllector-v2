// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/beefy/IStrategyV7.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

struct LensResult {
    uint256 callReward;
    uint256 lastHarvest;
    uint256 gasUsed;
    bool paused;
    bool success;
}

// Simulate a harvest while recieving a call reward. Return callReward amount and whether or not it was a success.
contract BeefyHarvestLens {
    using SafeERC20 for IERC20;

    // Simulate harvest calling callStatic/simulateContract for return results.
    // this method will hide any harvest errors and it is not recommended to use it to do the harvesting
    // only the simulation using callStatic/simulateContract is recommended
    function harvest(IStrategyV7 _strategy, IERC20 _rewardToken) external returns (LensResult memory) {
        // save a tiny bit of gas by not writing to the struct until the end
        uint256 callReward = 0;
        uint256 lastHarvest = 0;
        uint256 gasUsed = 0;
        bool success = false;

        bool paused = _strategy.paused();

        // some strategies don't have lastHarvest
        try _strategy.lastHarvest() returns (uint256 _lastHarvest) {
            lastHarvest = _lastHarvest;
        } catch {}

        if (!paused) {
            uint256 rewardsBefore = IERC20(_rewardToken).balanceOf(address(this));
            uint256 gasBefore = gasleft();
            try _strategy.harvest(address(this)) {
                success = true;
            } catch {
                success = false;
            }
            uint256 gasAfter = gasleft();

            if (success) {
                callReward = IERC20(_rewardToken).balanceOf(address(this)) - rewardsBefore;
                gasUsed = gasBefore - gasAfter;

                // protection in case someone actually uses this contract to harvest despite our warnings
                if (callReward > 0) {
                    _rewardToken.safeTransfer(msg.sender, callReward);
                }
            }
        }

        return LensResult({
            callReward: callReward,
            lastHarvest: lastHarvest,
            gasUsed: gasUsed,
            paused: paused,
            success: success
        });
    }
}
