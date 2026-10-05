// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPoolInitializer_v4} from "@uniswap/v4-periphery/src/interfaces/IPoolInitializer_v4.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";

interface IERC20Minimal {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
}

interface IAelvoraMigrationSource {
    function migrationEthAmount() external view returns (uint256);
    function migrationTokenAmount() external view returns (uint256);
    function migrationStarted() external view returns (bool);
    function migrationCompleted() external view returns (bool);
}

contract AelvoraV4Migration is Ownable {

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;

    uint24 public immutable lpFee;
    int24 public immutable tickSpacing;

    error ZeroAddress();
    error InvalidConfig();
    error MigrationNotReady();
    error AlreadyCompleted();
    error UnsupportedCurrency();
    error TransferFailed();
    error PositionNotLocked();

    event PoolInitialized(
        address indexed curve,
        bytes32 indexed poolId,
        uint160 sqrtPriceX96
    );

    event LiquidityMigrated(
        address indexed curve,
        uint256 tokenId,
        uint256 ethAmount,
        uint256 tokenAmount
    );

    event PositionLocked(
        address indexed curve,
        uint256 tokenId
    );

    /*
     * The migration executor itself owns the V4 position NFT.
     *
     * IMPORTANT:
     * The NFT is transferred to address(1), not address(0),
     * because ERC721 implementations may reject zero-address
     * transfers/burn semantics.
     *
     * address(1) is intentionally unrecoverable by Aelvora:
     * this contract never exposes any withdrawal/transfer function
     * for the position NFT.
     */
    address public constant PERMANENT_LOCK =
        address(0x0000000000000000000000000000000000000001);

    constructor(
        address poolManager_,
        address positionManager_,
        uint24 lpFee_,
        int24 tickSpacing_
    )
        Ownable(msg.sender)
    {
        if (
            poolManager_ == address(0) ||
            positionManager_ == address(0)
        ) {
            revert ZeroAddress();
        }

        if (tickSpacing_ <= 0) {
            revert InvalidConfig();
        }

        poolManager = IPoolManager(poolManager_);
        positionManager = IPositionManager(positionManager_);

        lpFee = lpFee_;
        tickSpacing = tickSpacing_;
    }

    /*
     * V4 pool initialization.
     *
     * The caller supplies the exact PoolKey and starting sqrt price.
     * This keeps chain-specific V4 configuration outside the curve.
     */
    function initializePool(
        PoolKey calldata key,
        uint160 sqrtPriceX96
    )
        external
        onlyOwner
    {
        IPoolInitializer_v4(address(positionManager))
            .initializePool(key, sqrtPriceX96);
    }

    /*
     * Migration entry point.
     *
     * This function is intentionally retryable.
     *
     * If anything below reverts:
     *   - migrationCompleted on the curve is NOT touched
     *   - the entire transaction reverts
     *   - the same migration can be attempted again
     */
    function migrate(
        address curve,
        PoolKey calldata key,
        int24 tickLower,
        int24 tickUpper,
        uint256 liquidity,
        uint128 amount0Max,
        uint128 amount1Max,
        uint160 sqrtPriceX96
    )
        external
        onlyOwner
    {
        IAelvoraMigrationSource source =
            IAelvoraMigrationSource(curve);

        if (!source.migrationStarted()) {
            revert MigrationNotReady();
        }

        if (source.migrationCompleted()) {
            revert AlreadyCompleted();
        }

        uint256 ethAmount =
            source.migrationEthAmount();

        uint256 tokenAmount =
            source.migrationTokenAmount();

        if (
            ethAmount == 0 ||
            tokenAmount == 0 ||
            liquidity == 0
        ) {
            revert InvalidConfig();
        }

        /*
         * Initialize the pool.
         *
         * If already initialized, this call will revert.
         *
         * Therefore the production implementation should call
         * initializePool only during the first migration attempt
         * or use a pool-state check before calling it.
         */
        IPoolInitializer_v4(address(positionManager))
            .initializePool(
                key,
                sqrtPriceX96
            );

        /*
         * Token side.
         *
         * The bonding curve must transfer the migration token
         * amount to this executor before this call.
         */
        IERC20Minimal token =
            IERC20Minimal(Currency.unwrap(key.currency0) == address(0)
                ? Currency.unwrap(key.currency1)
                : Currency.unwrap(key.currency0));

        token.approve(
            address(positionManager),
            tokenAmount
        );

        /*
         * MINT_POSITION + SETTLE_PAIR.
         *
         * No BURN_POSITION.
         */
        bytes memory actions =
            abi.encodePacked(
                uint8(Actions.MINT_POSITION),
                uint8(Actions.SETTLE_PAIR)
            );

        bytes[] memory params =
            new bytes[](2);

        params[0] = abi.encode(
            key,
            tickLower,
            tickUpper,
            liquidity,
            amount0Max,
            amount1Max,
            address(this),
            bytes("")
        );

        params[1] = abi.encode(
            key.currency0,
            key.currency1
        );

        uint256 tokenIdBefore =
            positionManager.nextTokenId();

        positionManager.modifyLiquidities{value: ethAmount}(
            abi.encode(actions, params),
            block.timestamp + 300
        );

        uint256 tokenId =
            tokenIdBefore;

        /*
         * Permanent lock.
         *
         * We do NOT call BURN_POSITION.
         */
        IERC721Minimal(address(positionManager))
            .transferFrom(
                address(this),
                PERMANENT_LOCK,
                tokenId
            );

        if (
            IERC721Minimal(address(positionManager))
                .ownerOf(tokenId)
                != PERMANENT_LOCK
        ) {
            revert PositionNotLocked();
        }

        emit LiquidityMigrated(
            curve,
            tokenId,
            ethAmount,
            tokenAmount
        );

        emit PositionLocked(
            curve,
            tokenId
        );
    }
}
