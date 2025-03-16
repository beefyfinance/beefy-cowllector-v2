// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// import SafeERC20
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// implements IStrategyV7 and allow mocking of all functions on the constructor
// also adds a parameter to revert on harvest
contract StrategyV7Mock {
    using SafeERC20 for IERC20;

    IERC20 public native;
    uint256 public lastHarvestMock;
    bool public pausedMock;
    bool public isCalmBeforeHarvest;
    uint256 public harvestLoops;
    bool public revertOnHarvest;
    bool public revertOnLastHarvest;
    bool public revertOnIsCalm;
    uint256 public harvestRewards;

    constructor(
        IERC20 _native,
        uint256 _lastHarvestMock,
        bool _pausedMock,
        bool _isCalmBeforeHarvest,
        uint256 _harvestLoops,
        bool _revertOnHarvest,
        bool _revertOnLastHarvest,
        bool _revertOnIsCalm,
        uint256 _harvestRewards
    ) {
        native = _native;
        lastHarvestMock = _lastHarvestMock;
        pausedMock = _pausedMock;
        isCalmBeforeHarvest = _isCalmBeforeHarvest;
        harvestLoops = _harvestLoops;
        revertOnHarvest = _revertOnHarvest;
        revertOnLastHarvest = _revertOnLastHarvest;
        revertOnIsCalm = _revertOnIsCalm;
        harvestRewards = _harvestRewards;
    }

    function lastHarvest() external view returns (uint256) {
        if (revertOnLastHarvest) {
            revert("revertOnLastHarvest");
        }
        return lastHarvestMock;
    }

    function harvest(address callReceipient) external {
        if (revertOnHarvest) {
            revert("revertOnHarvest");
        }
        // consume some gas
        for (uint256 i = 0; i < harvestLoops; i++) {
            keccak256(abi.encode(i));
        }

        native.safeTransfer(callReceipient, harvestRewards);
    }

    function isCalm() external view returns (bool) {
        if (revertOnIsCalm) {
            revert("revertOnIsCalm");
        }
        return isCalmBeforeHarvest;
    }

    function paused() external view returns (bool) {
        return pausedMock;
    }
}
