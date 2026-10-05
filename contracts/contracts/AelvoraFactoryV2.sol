// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AelvoraTokenV2.sol";
import "./AelvoraBondingCurve.sol";
import "./AelvoraCreatorFeeVault.sol";
import "./AelvoraV4Migrator.sol";

contract AelvoraFactoryV2 {
    uint256 public constant LAUNCH_FEE = 0.0003 ether;

    // Maximum supply: 1 trillion tokens (18 decimals)
    uint256 public constant MAX_TOTAL_SUPPLY =
        1_000_000_000_000 * 10 ** 18;

    uint256 public constant MAX_CREATOR_TAX_BPS = 500;
    uint256 public constant MAX_METADATA_LENGTH = 512;

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

    struct CreateTokenParams {
        string name;
        string symbol;
        uint256 totalSupply;
        uint256 creatorTaxBps;
        uint256 firstBuyEth;
        string website;
        string twitter;
        string telegram;
        string logoURI;
    }

    // Official bonding curves created by this Factory.
    mapping(address => bool) public isCurve;

    error IncorrectLaunchFee();
    error InvalidSupply();
    error InvalidCreatorTax();
    error ZeroAddress();
    error LaunchFeeTransferFailed();
    error InvalidFirstBuy();
    error MetadataTooLong();

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

        // Factory V2 membuat Vault baru miliknya sendiri.
        creatorFeeVault = new AelvoraCreatorFeeVault(address(this));
    }

    function createToken(
        CreateTokenParams calldata p
    ) external payable returns (address tokenAddress) {
        if (p.firstBuyEth == 0) {
            revert InvalidFirstBuy();
        }

        if (msg.value != LAUNCH_FEE + p.firstBuyEth) {
            revert IncorrectLaunchFee();
        }

        if (
            p.totalSupply == 0 ||
            p.totalSupply > MAX_TOTAL_SUPPLY
        ) {
            revert InvalidSupply();
        }

        if (p.creatorTaxBps > MAX_CREATOR_TAX_BPS) {
            revert InvalidCreatorTax();
        }

        if (
            bytes(p.website).length > MAX_METADATA_LENGTH ||
            bytes(p.twitter).length > MAX_METADATA_LENGTH ||
            bytes(p.telegram).length > MAX_METADATA_LENGTH ||
            bytes(p.logoURI).length > MAX_METADATA_LENGTH
        ) {
            revert MetadataTooLong();
        }

        tokenAddress = _deployToken(p);

        AelvoraBondingCurve curve =
            AelvoraBondingCurve(
                payable(tokenInfo[tokenAddress].curve)
            );

        // V1 INITIAL BUY — dipertahankan.
        curve.buyFor{value: p.firstBuyEth}(msg.sender);

        // V1 LAUNCH FEE 0.0003 ETH — dipertahankan.
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
            p.name,
            p.symbol,
            p.totalSupply,
            p.creatorTaxBps
        );
    }

    function _deployToken(
        CreateTokenParams calldata p
    )
        internal
        returns (address tokenAddress)
    {
        // V1 behavior dipertahankan:
        // Token creator tetap address(this), sedangkan
        // creator BondingCurve tetap msg.sender.
        AelvoraTokenV2 token = _deployAelvoraToken(p);

        tokenAddress = address(token);

        AelvoraBondingCurve curve =
            new AelvoraBondingCurve(
                tokenAddress,
                msg.sender,
                tradingFeeRecipient,
                address(creatorFeeVault),
                p.creatorTaxBps
            );

        isCurve[address(curve)] = true;

        bool approved = token.approve(
            address(curve),
            p.totalSupply
        );

        if (!approved) {
            revert LaunchFeeTransferFailed();
        }

        // V1 liquidity initialization — TIDAK diubah.
        curve.initializeLiquidity(p.totalSupply);

        // V1 V4 migrator wiring — TIDAK diubah.
        AelvoraV4Migrator migrator = new AelvoraV4Migrator(
            v4PoolManager,
            address(curve),
            tokenAddress,
            launchFeeRecipient
        );

        curve.setMigrator(address(migrator));

        // V1 creator fee vault registration — TIDAK diubah.
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
            totalSupply: p.totalSupply,
            creatorTaxBps: p.creatorTaxBps,
            createdAt: block.timestamp
        });
    }

    function _deployAelvoraToken(
        CreateTokenParams calldata p
    ) internal returns (AelvoraTokenV2 token) {
        token = new AelvoraTokenV2(
            p.name,
            p.symbol,
            p.totalSupply,
            p.creatorTaxBps,
            address(this),
            tradingFeeRecipient,
            address(creatorFeeVault),
            p.website,
            p.twitter,
            p.telegram,
            p.logoURI
        );
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
