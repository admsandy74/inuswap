// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AelvoraCreatorFeeVault is ReentrancyGuard {
    uint256 public constant CLAIM_COOLDOWN = 5 minutes;

    address public immutable factory;

    // curve => token
    mapping(address => address) public curveToken;

    // curve => creator
    mapping(address => address) public curveCreator;

    // token => creator => claimable ETH
    mapping(address => mapping(address => uint256))
        public creatorRewards;

    // token => creator => last successful claim
    mapping(address => mapping(address => uint256))
        public lastClaimAt;

    error OnlyFactory();
    error OnlyRegisteredCurve();
    error ZeroAddress();
    error CurveAlreadyRegistered();
    error NoRewards();
    error ClaimCooldown();
    error TransferFailed();
    error InsufficientVaultBalance();

    event CurveRegistered(
        address indexed curve,
        address indexed token,
        address indexed creator
    );

    event CreatorFeeAccrued(
        address indexed token,
        address indexed creator,
        uint256 amount
    );

    event CreatorRewardsClaimed(
        address indexed token,
        address indexed creator,
        uint256 amount
    );

    constructor(address factory_) {
        if (factory_ == address(0)) {
            revert ZeroAddress();
        }

        factory = factory_;
    }

    modifier onlyFactory() {
        if (msg.sender != factory) {
            revert OnlyFactory();
        }
        _;
    }

    modifier onlyRegisteredCurve() {
        if (curveToken[msg.sender] == address(0)) {
            revert OnlyRegisteredCurve();
        }
        _;
    }

    function registerCurve(
        address curve,
        address token,
        address creator
    ) external onlyFactory {
        if (
            curve == address(0) ||
            token == address(0) ||
            creator == address(0)
        ) {
            revert ZeroAddress();
        }

        if (curveToken[curve] != address(0)) {
            revert CurveAlreadyRegistered();
        }

        curveToken[curve] = token;
        curveCreator[curve] = creator;

        emit CurveRegistered(
            curve,
            token,
            creator
        );
    }

    function accrueCreatorFee(
        address token,
        address creator
    ) external payable onlyRegisteredCurve {
        if (token == address(0) || creator == address(0)) {
            revert ZeroAddress();
        }

        // Curve harus cocok dengan token dan creator
        // yang didaftarkan Factory.
        if (
            curveToken[msg.sender] != token ||
            curveCreator[msg.sender] != creator
        ) {
            revert OnlyRegisteredCurve();
        }

        if (msg.value == 0) {
            return;
        }

        creatorRewards[token][creator] += msg.value;

        emit CreatorFeeAccrued(
            token,
            creator,
            msg.value
        );
    }

    function claim(
        address token
    ) external nonReentrant returns (uint256 amount) {
        if (token == address(0)) {
            revert ZeroAddress();
        }

        amount = creatorRewards[token][msg.sender];

        if (amount == 0) {
            revert NoRewards();
        }

        uint256 last = lastClaimAt[token][msg.sender];

        if (
            last != 0 &&
            block.timestamp < last + CLAIM_COOLDOWN
        ) {
            revert ClaimCooldown();
        }

        if (address(this).balance < amount) {
            revert InsufficientVaultBalance();
        }

        // CEK -> ZERO -> TRANSFER
        // mencegah double claim / reentrancy.
        creatorRewards[token][msg.sender] = 0;
        lastClaimAt[token][msg.sender] = block.timestamp;

        (bool sent, ) = payable(msg.sender).call{
            value: amount
        }("");

        if (!sent) {
            revert TransferFailed();
        }

        emit CreatorRewardsClaimed(
            token,
            msg.sender,
            amount
        );
    }

    function claimable(
        address token,
        address creator
    ) external view returns (uint256) {
        return creatorRewards[token][creator];
    }

    function canClaim(
        address token,
        address creator
    )
        external
        view
        returns (
            bool allowed,
            uint256 amount,
            uint256 nextClaimAt
        )
    {
        amount = creatorRewards[token][creator];

        if (amount == 0) {
            return (false, 0, 0);
        }

        uint256 last = lastClaimAt[token][creator];

        if (last == 0) {
            return (true, amount, 0);
        }

        nextClaimAt = last + CLAIM_COOLDOWN;
        allowed = block.timestamp >= nextClaimAt;
    }

    function vaultBalance()
        external
        view
        returns (uint256)
    {
        return address(this).balance;
    }

    receive() external payable {}
}
