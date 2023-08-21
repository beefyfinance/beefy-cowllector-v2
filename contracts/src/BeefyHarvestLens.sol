// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/beefy/IStrategyV7.sol";
import "./interfaces/wnative/IWETH.sol";

struct LensResult {
    uint256 callReward;
    uint256 lastHarvest;
    uint256 balanceBefore;
    uint256 balanceAfter;
    bool paused;
    bool success;
}

// Simulate a harvest while recieving a call reward. Return callReward amount and whether or not it was a success.
contract BeefyHarvestLens {
    // What is the call reward token?
    IWETH public wnative;
    bool private _init;

    function init(IWETH _wnative) external {
        require(!_init);
        wnative = _wnative;
        _init = true;
    }

    // Allow this contract to recieve ETH when unwrapping WETH
    receive() external payable {} // Function to receive Ether. msg.data must be empty
    fallback() external payable {} // Fallback function is called when msg.data is not empty

    // Simulate harvest calling callStatic for return results. Can also just call harvest and get reward.
    function harvest(IStrategyV7 _strategy, bool _captureHarvestErrors) external returns (LensResult memory) {
        // save a tiny bit of gas by not writing to the struct until the end
        uint256 callReward = 0;
        uint256 lastHarvest = 0;
        uint256 balanceBefore = 0;
        uint256 balanceAfter = 0;
        bool paused = false;
        bool success = false;

        // when the strategy is paused, we can't harvest at all
        paused = _strategy.paused();
        if (paused) {
            return LensResult({
                callReward: callReward,
                lastHarvest: lastHarvest,
                balanceBefore: balanceBefore,
                balanceAfter: balanceAfter,
                paused: paused,
                success: success
            });
        }

        // some strategies don't have lastHarvest
        try _strategy.lastHarvest() returns (uint256 _lastHarvest) {
            lastHarvest = _lastHarvest;
        } catch {}

        balanceBefore = address(msg.sender).balance;

        if (_captureHarvestErrors) {
            try _strategy.harvest(address(this)) {
                success = true;
            } catch {}
        } else {
            _strategy.harvest(address(this));
            success = true;
        }

        if (success) {
            // harvest succeeded, unwrap rewards
            callReward = wnative.balanceOf(address(this));
            if (callReward > 0) {
                wnative.withdraw(callReward);
                // transfer rewards to caller
                payable(msg.sender).transfer(callReward);
            }
        }

        balanceAfter = address(msg.sender).balance;

        return LensResult({
            callReward: callReward,
            lastHarvest: lastHarvest,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            paused: paused,
            success: success
        });
    }
}
