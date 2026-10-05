pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {V4Router} from "@uniswap/v4-periphery/src/V4Router.sol";
import {IV4Router} from "@uniswap/v4-periphery/src/interfaces/IV4Router.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {ReentrancyLock} from "@uniswap/v4-periphery/src/base/ReentrancyLock.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ActionConstants} from "@uniswap/v4-periphery/src/libraries/ActionConstants.sol";

contract AelvoraSwapRouter is V4Router, ReentrancyLock {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint256 public constant SWAP_FEE_BPS = 10; // 0.10%

    address public immutable feeRecipient;

    error ZeroAddress();
    error InvalidAmount();
    error InvalidRecipient();
    error InvalidCurrency();
    error InvalidMsgValue();

    event SwapFeePaid(
        address indexed user,
        address indexed currency,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 swapAmount
    );

    constructor(
        IPoolManager poolManager_,
        address feeRecipient_
    ) V4Router(poolManager_) {
        if (address(poolManager_) == address(0)) revert ZeroAddress();
        if (feeRecipient_ == address(0)) revert ZeroAddress();

        feeRecipient = feeRecipient_;
    }

    /**
     * @notice V4 router user context.
     * ReentrancyLock stores the original caller in transient storage.
     */
    function msgSender()
        public
        view
        override
        returns (address)
    {
        return _getLocker();
    }

    /**
     * @notice Swap native ETH -> ERC20 through one V4 pool.
     * A 0.10% platform fee is taken from the ETH input.
     */
    function swapExactETHForTokens(
        PoolKey calldata poolKey,
        bool zeroForOne,
        uint128 amountOutMinimum,
        address recipient
    )
        external
        payable
        isNotLocked
    {
        if (msg.value == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();

        Currency currencyIn =
            zeroForOne ? poolKey.currency0 : poolKey.currency1;

        Currency currencyOut =
            zeroForOne ? poolKey.currency1 : poolKey.currency0;

        if (Currency.unwrap(currencyIn) != address(0)) {
            revert InvalidCurrency();
        }

        if (Currency.unwrap(currencyOut) == address(0)) {
            revert InvalidCurrency();
        }

        uint256 fee =
            (msg.value * SWAP_FEE_BPS) / BPS;

        uint256 amountIn =
            msg.value - fee;

        if (amountIn == 0) revert InvalidAmount();

        _sendETH(feeRecipient, fee);

        emit SwapFeePaid(
            msg.sender,
            address(0),
            msg.value,
            fee,
            amountIn
        );

        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE),
            uint8(Actions.TAKE)
        );

        bytes[] memory params = new bytes[](3);

        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: zeroForOne,
                amountIn: uint128(amountIn),
                amountOutMinimum: amountOutMinimum,
                hookData: bytes("")
            })
        );

        params[1] = abi.encode(
            currencyIn,
            amountIn,
            false
        );

        params[2] = abi.encode(
            currencyOut,
            recipient,
            ActionConstants.OPEN_DELTA
        );

        poolManager.unlock(
            abi.encode(actions, params)
        );
    }

    /**
     * @notice Swap ERC20 input through one V4 pool.
     * A 0.10% platform fee is taken from the ERC20 input.
     * Output can be another ERC20 or native ETH.
     */
    function swapExactTokensForTokens(
        PoolKey calldata poolKey,
        bool zeroForOne,
        uint128 amountInGross,
        uint128 amountOutMinimum,
        address recipient
    )
        external
        isNotLocked
    {
        if (amountInGross == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();

        Currency currencyIn =
            zeroForOne ? poolKey.currency0 : poolKey.currency1;

        Currency currencyOut =
            zeroForOne ? poolKey.currency1 : poolKey.currency0;

        address tokenIn =
            Currency.unwrap(currencyIn);

        if (tokenIn == address(0)) {
            revert InvalidCurrency();
        }

        uint256 fee =
            (uint256(amountInGross) * SWAP_FEE_BPS) / BPS;

        uint256 amountIn =
            uint256(amountInGross) - fee;

        if (amountIn == 0) revert InvalidAmount();

        IERC20(tokenIn).safeTransferFrom(
            msg.sender,
            address(this),
            amountInGross
        );

        if (fee > 0) {
            IERC20(tokenIn).safeTransfer(
                feeRecipient,
                fee
            );
        }

        emit SwapFeePaid(
            msg.sender,
            tokenIn,
            amountInGross,
            fee,
            amountIn
        );

        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE),
            uint8(Actions.TAKE)
        );

        bytes[] memory params = new bytes[](3);

        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: zeroForOne,
                amountIn: uint128(amountIn),
                amountOutMinimum: amountOutMinimum,
                hookData: bytes("")
            })
        );

        params[1] = abi.encode(
            currencyIn,
            amountIn,
            false
        );

        params[2] = abi.encode(
            currencyOut,
            recipient,
            ActionConstants.OPEN_DELTA
        );

        poolManager.unlock(
            abi.encode(actions, params)
        );
    }

    /**
     * @dev V4Router calls this when settling ERC20 currency.
     * The router already holds the exact net input amount.
     */
    function _pay(
        Currency currency,
        address,
        uint256 amount
    )
        internal
        override
    {
        address token =
            Currency.unwrap(currency);

        if (token == address(0)) {
            revert InvalidCurrency();
        }

        IERC20(token).safeTransfer(
            address(poolManager),
            amount
        );
    }

    function _sendETH(
        address to,
        uint256 amount
    )
        internal
    {
        if (amount == 0) return;

        (bool success, ) =
            payable(to).call{value: amount}("");

        if (!success) {
            revert InvalidMsgValue();
        }
    }

    receive() external payable {}
}
