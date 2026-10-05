// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AelvoraToken is ERC20 {
    uint256 public constant MAX_CREATOR_TAX_BPS = 500;
    uint256 public constant PLATFORM_FEE_BPS = 100;

    address public immutable creator;
    address public immutable tradingFeeRecipient;
    address public immutable creatorFeeVault;

    uint256 public immutable creatorTaxBps;

    mapping(address => uint256) public creatorRewards;

    error InvalidCreatorTax();
    error ZeroAddress();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 creatorTaxBps_,
        address creator_,
        address tradingFeeRecipient_,
        address creatorFeeVault_
    ) ERC20(name_, symbol_) {
        if (creatorTaxBps_ > MAX_CREATOR_TAX_BPS) {
            revert InvalidCreatorTax();
        }

        if (
            creator_ == address(0) ||
            tradingFeeRecipient_ == address(0) ||
            creatorFeeVault_ == address(0)
        ) {
            revert ZeroAddress();
        }

        creator = creator_;
        tradingFeeRecipient = tradingFeeRecipient_;
        creatorFeeVault = creatorFeeVault_;
        creatorTaxBps = creatorTaxBps_;

        _mint(creator_, totalSupply_);
    }
}
