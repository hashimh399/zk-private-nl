//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import "./Nl.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/*
INVARIANTS:
1. ETH Solvency: address(this).balance >= totalEthEscrowed
2. AUTHORITY: only POOL_ROLE can move ETH balances  , Only Vault can mint NL
3. INFLATION CONTROL: dailyMinted <=dailyMintLimit
4. PAUSE SAFETY when Paused: NO ETH MOVES , No NL Minting
5. Accounting Consistency: totalEthEscrowed == sum(ethBalance[user])
*/

contract Vault is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant POOL_ROLE = keccak256("POOL_ROLE");
    // ETH //
    mapping(address => uint256) public ethBalance;
    uint256 public totalEthEscrowed;

    event EthDeposited(address indexed user, uint256 amount);
    event EthWithdrawn(address indexed user, uint256 amount);

    //NL //

    NeuroLedger public immutable token;

    uint256 public dailyMintLimit;
    uint256 public dailyMinted;
    uint256 public lastMintReset;

    event fundsMinted(address indexed to, uint256 amount);
    event DailyMintReset(uint256 timestamp);
    event MintLimitUpdated(uint256 newLimit);

    //SETUP //

    constructor(
        address admin,
        // address lendingPool,
        address nlToken,
        uint256 _dailyMintLimit
    ) {
        require(admin != address(0), "Invalid admin address");
        // require(lendingPool != address(0), "Invalid pool address");
        require(nlToken != address(0), "Invalid token address");

        token = NeuroLedger(nlToken);
        dailyMintLimit = _dailyMintLimit;
        lastMintReset = block.timestamp;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        // _grantRole(POOL_ROLE, lendingPool);
    }
    // Admin controls //

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
 function setPool(address lendingPool) external onlyRole(DEFAULT_ADMIN_ROLE) {
    require(lendingPool != address(0), "Invalid pool");
    require(!hasRole(POOL_ROLE, lendingPool), "Pool already set");
    _grantRole(POOL_ROLE, lendingPool);
}

    function setDailyMintLimit(
        uint256 newLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyMintLimit = newLimit;
        emit MintLimitUpdated(newLimit);
    }

    //ETH ESCROW LOGIC //
    // @notice Deposit ETH on bhealf of user (called by lP)
    function depositETH(
        address user
    ) external payable onlyRole(POOL_ROLE) whenNotPaused {
        require(msg.value > 0, "Deposit amount must be greater than zero");
        require(user != address(0), "Invalid user address");
        ethBalance[user] += msg.value;
        totalEthEscrowed += msg.value;

        emit EthDeposited(user, msg.value);
    }

    /// @notice withdraw ETH to user (auth by LP)
    function withdrawETH(
        address user,
        uint256 amount
    ) external onlyRole(POOL_ROLE) nonReentrant whenNotPaused {
        require(amount > 0, "Withdraw amount must be greater than zero");
        require(ethBalance[user] >= amount, "Insufficient balance for user");
        ethBalance[user] -= amount;
        totalEthEscrowed -= amount;

        (bool success, ) = user.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit EthWithdrawn(user, amount);
    }

    //NL MINTING LOGIC //
    function mintNL(
        address to,
        uint256 amount
    ) external onlyRole(POOL_ROLE) whenNotPaused {
        require(amount > 0, "Mint amount must be greater than zero");
        require(to != address(0), "Invalid recipient address");
        _resetDailyMintIfneeded();
        require(
            dailyMinted + amount <= dailyMintLimit,
            "Daily mint limit exceeded"
        );
        dailyMinted += amount;
        token.mint(to, amount);

        emit fundsMinted(to, amount);
    }

    function _resetDailyMintIfneeded() internal {
        if (block.timestamp >= lastMintReset + 1 days) {
            dailyMinted = 0;
            lastMintReset = block.timestamp;
            emit DailyMintReset(block.timestamp);
        }
    }

    /// @notice Internal ETH escrow transfer between users (used for liqudiation)

    function transferEscrow(
        address from,
        address to,
        uint256 amount
    ) external onlyRole(POOL_ROLE) whenNotPaused {
        require(from != address(0) && to != address(0), "Invalid address");
        require(amount > 0, "Zero amount");
        require(ethBalance[from] >= amount, "Insufficient escrow");

        ethBalance[from] -= amount;
        ethBalance[to] += amount;
    }

    /// @notice Accept ETH sent directly (selfdestruct / force-send)
    receive() external payable {
        // intentionally empty
        // accounting must NOT change here
    }

    function burnNL(uint256 amount) external onlyRole(POOL_ROLE) whenNotPaused {
        require(amount > 0, "ZERO BURN");
        token.burn(amount);
    }
    //SAFETY ASSERTION //

    //@notice hard invariant check for tests and monitoring
    function assertSolvent() external view {
        require(
            address(this).balance >= totalEthEscrowed,
            "Vault is insolvent"
        );
    }


}
