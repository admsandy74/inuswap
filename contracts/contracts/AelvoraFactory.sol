// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AelvoraToken.sol";
import "./AelvoraBondingCurve.sol";
import "./AelvoraCreatorFeeVault.sol";
import "./AelvoraV4Migrator.sol";

contract AelvoraFactory {
    uint256 public constant LAUNCH_FEE = 0.0003 ether;
    // Maximum supply: 1 trillion tokens (18 decimals)
    uint256 public constant MAX_TOTAL_SUPPLY =
        1_000_000_000_000 * 10 ** 18;
    uint256 public constant MAX_CREATOR_TAX_BPS = 500;

    address public immutable launchFeeRecipient;
    address public immutable tradingFeeRecipient;
    address public immutable v4PoolManager;
    address public immutable permanentOwner;
    AelvoraCreatorFeeVault public immutable creatorFeeVault;

    address[] public allTokens;

    struct TokenInfo {
        address token;
        address creator;
        address curve;
        uint256 totalSupply;
        uint256 creatorTaxBps;
        uint256 createdAt;
    }

    mapping(address => TokenInfo) public tokenInfo;

    // Official bonding curves created by this Factory.
    mapping(address => bool) public isCurve;

    error IncorrectLaunchFee();
    error InvalidSupply();
    error InvalidCreatorTax();
    error ZeroAddress();
    error LaunchFeeTransferFailed();
    error InvalidFirstBuy();

    event TokenCreated(
        address indexed token,
        address indexed creator,
        address indexed curve,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 creatorTaxBps
    );

    constructor(
        address launchFeeRecipient_,
        address tradingFeeRecipient_,
        address v4PoolManager_,
        address permanentOwner_
    ) {
        if (
            launchFeeRecipient_ == address(0) ||
            tradingFeeRecipient_ == address(0) ||
            v4PoolManager_ == address(0) ||
            permanentOwner_ == address(0)
        ) {
            revert ZeroAddress();
        }

        launchFeeRecipient = launchFeeRecipient_;
        tradingFeeRecipient = tradingFeeRecipient_;
        v4PoolManager = v4PoolManager_;
        permanentOwner = permanentOwner_;

        // Factory membuat Vault sendiri.
        // address(this) adalah address Factory yang sedang dibuat.
        creatorFeeVault = new AelvoraCreatorFeeVault(address(this));
    }

    function createToken(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply_,
        uint256 creatorTaxBps_,
        uint256 firstBuyEth_
    ) external payable returns (address tokenAddress) {
        if (firstBuyEth_ == 0) {
            revert InvalidFirstBuy();
        }

        if (msg.value != LAUNCH_FEE + firstBuyEth_) {
            revert IncorrectLaunchFee();
        }

        if (
            totalSupply_ == 0 ||
            totalSupply_ > MAX_TOTAL_SUPPLY
        ) {
            revert InvalidSupply();
        }

        if (creatorTaxBps_ > MAX_CREATOR_TAX_BPS) {
            revert InvalidCreatorTax();
        }

        tokenAddress = _deployToken(
            name_,
            symbol_,
            totalSupply_,
            creatorTaxBps_
        );

        AelvoraBondingCurve curve =
            AelvoraBondingCurve(
                payable(tokenInfo[tokenAddress].curve)
            );

        curve.buyFor{value: firstBuyEth_}(msg.sender);

        (bool sent, ) =
            payable(launchFeeRecipient).call{
                value: LAUNCH_FEE
            }("");

        if (!sent) {
            revert LaunchFeeTransferFailed();
        }

        _emitTokenCreated(
            tokenAddress,
            msg.sender,
            address(curve),
            name_,
            symbol_,
            totalSupply_,
            creatorTaxBps_
        );
    }

    function _deployToken(
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply_,
        uint256 creatorTaxBps_
    )
        internal
        returns (address tokenAddress)
    {
        AelvoraToken token = new AelvoraToken(
            name_,
            symbol_,
            totalSupply_,
            creatorTaxBps_,
            address(this),
            tradingFeeRecipient,
            address(creatorFeeVault)
        );

        tokenAddress = address(token);

        AelvoraBondingCurve curve =
            new AelvoraBondingCurve(
                tokenAddress,
                msg.sender,
                tradingFeeRecipient,
                address(creatorFeeVault),
                creatorTaxBps_
            );

        isCurve[address(curve)] = true;

        bool approved = token.approve(
            address(curve),
            totalSupply_
        );

        if (!approved) {
            revert LaunchFeeTransferFailed();
        }

        curve.initializeLiquidity(totalSupply_);

        // Deploy and wire the V4 migrator for this curve.
        AelvoraV4Migrator migrator = new AelvoraV4Migrator(
            v4PoolManager,
            address(curve),
            tokenAddress,
            launchFeeRecipient
        );

        curve.setMigrator(address(migrator));

        creatorFeeVault.registerCurve(
            address(curve),
            tokenAddress,
            msg.sender
        );

        allTokens.push(tokenAddress);

        tokenInfo[tokenAddress] = TokenInfo({
            token: tokenAddress,
            creator: msg.sender,
            curve: address(curve),
            totalSupply: totalSupply_,
            creatorTaxBps: creatorTaxBps_,
            createdAt: block.timestamp
        });
    }

    function _emitTokenCreated(
        address tokenAddress,
        address creator,
        address curve,
        string calldata name_,
        string calldata symbol_,
        uint256 totalSupply_,
        uint256 creatorTaxBps_
    ) internal {
        emit TokenCreated(
            tokenAddress,
            creator,
            curve,
            name_,
            symbol_,
            totalSupply_,
            creatorTaxBps_
        );
    }

    function tokenCount()
        external
        view
        returns (uint256)
    {
        return allTokens.length;
    }

    function curveOf(address token)
        external
        view
        returns (address)
    {
        return tokenInfo[token].curve;
    }
}
