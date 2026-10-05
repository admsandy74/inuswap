// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {
    IPoolManager
} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {
    IHooks
} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {
    PoolKey
} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {
    PoolId
} from "@uniswap/v4-core/src/types/PoolId.sol";

import {
    Currency,
    CurrencyLibrary
} from "@uniswap/v4-core/src/types/Currency.sol";

import {
    ModifyLiquidityParams
} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {
    BalanceDelta
} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

import {
    IUnlockCallback
} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";

import {
    TickMath
} from "@uniswap/v4-core/src/libraries/TickMath.sol";


import {
    FullMath
} from "@uniswap/v4-core/src/libraries/FullMath.sol";

import {
    LiquidityAmounts
} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";


contract AelvoraV4Migrator is IUnlockCallback {

    using CurrencyLibrary for Currency;

    IPoolManager public immutable poolManager;

    address public immutable curve;

    address public immutable token;

    address public immutable permanentOwner;

    PoolKey public poolKey;

    bool public poolInitialized;

    bool public liquidityAdded;

    uint256 public migratedEth;
    uint256 public migratedToken;

    error OnlyCurve();
    error OnlyPoolManager();
    error AlreadyInitialized();
    error NotInitialized();
    error AlreadyMigrated();
    error InvalidAmount();
    error PoolInitFailed();
    error MigrationFailed();

    event PoolInitialized(
        bytes32 indexed poolId,
        uint160 sqrtPriceX96
    );

    event LiquidityMigrated(
        uint256 ethAmount,
        uint256 tokenAmount
    );

    constructor(
        address poolManager_,
        address curve_,
        address token_,
        address permanentOwner_
    ) {
        if (
            poolManager_ == address(0) ||
            curve_ == address(0) ||
            token_ == address(0) ||
            permanentOwner_ == address(0)
        ) {
            revert InvalidAmount();
        }

        poolManager = IPoolManager(poolManager_);
        curve = curve_;
        token = token_;
        permanentOwner = permanentOwner_;
    }

    modifier onlyCurve() {
        if (msg.sender != curve) {
            revert OnlyCurve();
        }
        _;
    }

    /*
     * Called by AelvoraBondingCurve after graduation.
     *
     * IMPORTANT:
     * This only records the migration target.
     * Actual V4 execution can be retried later.
     */
    function migrate(
        uint256 ethAmount,
        uint256 tokenAmount
    )
        external
        onlyCurve
        returns (bool)
    {
        if (liquidityAdded) {
            revert AlreadyMigrated();
        }

        if (
            ethAmount == 0 ||
            tokenAmount == 0
        ) {
            revert InvalidAmount();
        }

        /*
         * The Curve transfers the assets before calling us.
         * Verify that this contract actually received them.
         */
        if (address(this).balance < ethAmount) {
            revert MigrationFailed();
        }

        if (
            IERC20(token).balanceOf(address(this))
                < tokenAmount
        ) {
            revert MigrationFailed();
        }

        /*
         * Pool initialization MUST use the same migration ratio
         * that is used for the liquidity calculation.
         */
        _ensurePool(
            ethAmount,
            tokenAmount
        );

        _addLiquidity(
            ethAmount,
            tokenAmount
        );

        migratedEth = ethAmount;
        migratedToken = tokenAmount;

        liquidityAdded = true;

        emit LiquidityMigrated(
            ethAmount,
            tokenAmount
        );

        return true;
    }

    function _ensurePool(
        uint256 ethAmount,
        uint256 tokenAmount
    )
        internal
    {
        if (poolInitialized) {
            return;
        }

        /*
         * Aelvora uses native ETH + ERC20 token.
         *
         * Currency ordering:
         * address(0) < token address
         */
        Currency currency0 =
            CurrencyLibrary.ADDRESS_ZERO;

        Currency currency1 =
            Currency.wrap(token);

        /*
         * Initial version:
         *
         *   fee        = 3000
         *   tickSpacing = 60
         *   hook       = address(0)
         *
         * This will be parameterized before deployment.
         */
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        /*
         * Initial V4 price must match the actual migration ratio.
         *
         * currency0 = native ETH
         * currency1 = AELVORA
         *
         * price = token1 / token0
         */
        uint160 sqrtPriceX96 =
            _sqrtPriceX96(
                ethAmount,
                tokenAmount
            );

        poolManager.initialize(
            key,
            sqrtPriceX96
        );

        poolKey = key;
        poolInitialized = true;

        emit PoolInitialized(
            PoolId.unwrap(key.toId()),
            sqrtPriceX96
        );
    }

    function _addLiquidity(
        uint256 ethAmount,
        uint256 tokenAmount
    )
        internal
    {
        /*
         * Full-range Aelvora ETH/token liquidity.
         *
         * The migration contract itself becomes the position owner
         * inside PoolManager because modifyLiquidity() records
         * msg.sender as the position owner.
         *
         * There is intentionally NO withdrawal/decrease-liquidity
         * function in this contract.
         */

        uint160 sqrtPriceX96 = _sqrtPriceX96(
            ethAmount,
            tokenAmount
        );

        /*
         * Full usable range for tickSpacing = 60.
         *
         * MIN_TICK / MAX_TICK are adjusted to multiples of 60.
         */
        int24 tickLower = -887220;
        int24 tickUpper = 887220;

        uint160 sqrtPriceLower =
            TickMath.getSqrtPriceAtTick(tickLower);

        uint160 sqrtPriceUpper =
            TickMath.getSqrtPriceAtTick(tickUpper);

        uint128 liquidity =
            LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96,
                sqrtPriceLower,
                sqrtPriceUpper,
                ethAmount,
                tokenAmount
            );

        if (liquidity == 0) {
            revert MigrationFailed();
        }

        ModifyLiquidityParams memory params =
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)),
                salt: bytes32(0)
            });

        /*
         * PoolManager must be unlocked before modifyLiquidity().
         */
        poolManager.unlock(
            abi.encode(
                params,
                ethAmount,
                tokenAmount
            )
        );
    }

    function _sqrtPriceX96(
        uint256 amount0,
        uint256 amount1
    )
        internal
        pure
        returns (uint160)
    {
        /*
         * price = token1 / token0
         *
         * sqrtPriceX96 =
         * sqrt(amount1 / amount0) * 2^96
         *
         * AelvoraToken is currently 18 decimals and ETH is 18 decimals.
         */
        if (amount0 == 0 || amount1 == 0) {
            revert InvalidAmount();
        }

        /*
         * FullMath avoids overflowing uint256 when multiplying
         * by 2^192.
         */
        uint256 ratioX192 =
            FullMath.mulDiv(
                amount1,
                uint256(1) << 192,
                amount0
            );

        uint256 sqrtRatio =
            _sqrt(ratioX192);

        if (
            sqrtRatio < uint256(TickMath.MIN_SQRT_PRICE) ||
            sqrtRatio > uint256(TickMath.MAX_SQRT_PRICE)
        ) {
            revert MigrationFailed();
        }

        return uint160(sqrtRatio);
    }

    function _sqrt(uint256 x)
        internal
        pure
        returns (uint256 y)
    {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function unlockCallback(
        bytes calldata data
    )
        external
        returns (bytes memory)
    {
        if (msg.sender != address(poolManager)) {
            revert OnlyPoolManager();
        }

        (
            ModifyLiquidityParams memory params,
            uint256 ethAmount,
            uint256 tokenAmount
        ) = abi.decode(
            data,
            (ModifyLiquidityParams, uint256, uint256)
        );

        /*
         * The liquidity position owner is address(this).
         */
        (BalanceDelta delta,) =
            poolManager.modifyLiquidity(
                poolKey,
                params,
                bytes("")
            );

        int128 delta0 = delta.amount0();
        int128 delta1 = delta.amount1();

        /*
         * Negative delta = migrator owes PoolManager.
         *
         * Positive delta = PoolManager owes migrator.
         *
         * For a fresh full-range position both sides should be
         * negative (or one side may have a tiny rounding remainder).
         */

        if (delta0 < 0) {
            uint256 amount0 = uint256(uint128(-delta0));

            if (amount0 > ethAmount) {
                revert MigrationFailed();
            }

            poolManager.sync(
                Currency.wrap(address(0))
            );
            poolManager.settle{value: amount0}();
        }

        if (delta1 < 0) {
            uint256 amount1 = uint256(uint128(-delta1));

            if (amount1 > tokenAmount) {
                revert MigrationFailed();
            }

            // sync MUST happen before the ERC20 transfer.
            // PoolManager snapshots the balance before payment.
            poolManager.sync(
                Currency.wrap(token)
            );

            IERC20(token).transfer(
                address(poolManager),
                amount1
            );

            poolManager.settle();
        }

        /*
         * Any positive delta would mean PoolManager owes the
         * migrator. That must NEVER happen during migration,
         * because we want all supplied assets committed to LP.
         */
        if (delta0 > 0 || delta1 > 0) {
            revert MigrationFailed();
        }

        return "";
    }

    receive() external payable {}
}
