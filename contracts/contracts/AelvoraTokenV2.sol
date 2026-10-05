// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AelvoraTokenV2 is ERC20 {
    uint256 public constant MAX_CREATOR_TAX_BPS = 500;
    uint256 public constant PLATFORM_FEE_BPS = 100;

    // Metadata ditanam saat deployment dan TIDAK memiliki setter.
    string public website;
    string public twitter;
    string public telegram;
    string public logoURI;

    address public immutable creator;
    address public immutable tradingFeeRecipient;
    address public immutable creatorFeeVault;

    uint256 public immutable creatorTaxBps;

    mapping(address => uint256) public creatorRewards;

    uint256 public constant MAX_METADATA_LENGTH = 512;

    error InvalidCreatorTax();
    error ZeroAddress();
    error MetadataTooLong();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 creatorTaxBps_,
        address creator_,
        address tradingFeeRecipient_,
        address creatorFeeVault_,
        string memory website_,
        string memory twitter_,
        string memory telegram_,
        string memory logoURI_
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

        if (
            bytes(website_).length > MAX_METADATA_LENGTH ||
            bytes(twitter_).length > MAX_METADATA_LENGTH ||
            bytes(telegram_).length > MAX_METADATA_LENGTH ||
            bytes(logoURI_).length > MAX_METADATA_LENGTH
        ) {
            revert MetadataTooLong();
        }

        creator = creator_;
        tradingFeeRecipient = tradingFeeRecipient_;
        creatorFeeVault = creatorFeeVault_;
        creatorTaxBps = creatorTaxBps_;

        website = website_;
        twitter = twitter_;
        telegram = telegram_;
        logoURI = logoURI_;

        _mint(creator_, totalSupply_);
    }
}
