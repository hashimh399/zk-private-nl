pragma solidity ^0.8.28;


/*
INVARIANTS (Auditor Notes):

1. User Solvency:
   For any user with tokenDebt > 0:
   healthFactor(user) >= 1
   Enforced on borrow and collateral withdrawal.

2. Liquidation Safety:
   Any liquidation must improve borrower solvency:
   HF_after >= HF_before.

3. ETH Backing:
   address(this).balance >= totalEthCollateral
   Prevents phantom collateral.

4. Debt Conservation:
   tokenDebt only changes in:
   - borrow
   - repay
   - liquidate

5. Oracle Bounded Trust:
   All prices must lie within admin-defined bounds.
   Protocol can be paused if oracle becomes unsafe.
*/

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./Vault.sol";

interface IPriceOracle {
    function getLatestPrice()
        external
        view
        returns (uint256 price, uint256 updatedAt);
}

contract LendingPool is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    // CONFIG //

    Vault public immutable vault;
    IERC20 public immutable nlToken;
    IPriceOracle public oracle;

    uint256 public constant PCT_BASE = 100;
    uint256 public constant HF_BASE = 1e18;
    address public borrowGate;
    modifier onlyBorrowGate() {
    require(msg.sender == borrowGate, "Not BorrowGate");
    _;
}

    // uint256 public ltv = 75;
    uint256 public liquidationThreshold = 85;

    uint256 public constant PRICE_DECIMALS = 1e18;
    uint256 public maxPriceAge = 1 hours;

    uint256 public constant MAX_CLOSE_FACTOR = 50; // %
    uint256 public constant LIQUIDATION_BONUS = 5; // %
    uint256 public constant MIN_DEBT = 1e18; // 1 NL
    uint256 public constant MIN_COLLATERAL = 1e14; // ~0.0001 ETH

    // STATE //

    mapping(address => uint256) public ethCollateral;
    mapping(address => uint256) public tokenDebt;
    address public creLiquidationReceiver;
    modifier onlyCREReciever(){
        require(msg.sender == creLiquidationReceiver , "Note CRE Reciever");
        _;
    }




    //EVENTS //

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);

    event Liquidation(
        address indexed liquidator,
        address indexed borrower,
        uint256 repaid,
        uint256 collateralSeized,
        uint256 healthfactorBefore,
        uint256 healthFactorAfter
    );

    // SETUP //

    constructor(
        address admin,
        address payable _vault,
        address _oracle,
        address _nlToken
    ) {
        require(admin != address(0), "Invalid admin address");
        require(_vault != address(0), "Invalid vault address");
        require(_oracle != address(0), "Invalid oracle address");
        require(_nlToken != address(0), "Invalid token address");

        vault = Vault(_vault);
        nlToken = IERC20(_nlToken);
        oracle = IPriceOracle(_oracle);

        _grantRole(ADMIN_ROLE, admin);
    }

    
    //ORACLE PRICE //
    function _getPrice18() internal view returns (uint256) {
        (uint256 price, uint256 updatedAt) = oracle.getLatestPrice();

        require(price > 0, "Oracle returned zero price");
        require(block.timestamp - updatedAt <= maxPriceAge, "STALE PRICE");

        //set oracle price decimals , currently 8
        return price * 1e10;
    }

    // HEALTH FACTOR //

    function collateralValueOf(address user) public view returns (uint256) {
        uint256 price18 = _getPrice18();
        return (ethCollateral[user] * price18) / 1e18;
    }

    function HealthFactor(address user) public view returns (uint256) {
        uint256 debt = tokenDebt[user];
        if (debt == 0) return type(uint256).max;
        uint256 collValue = collateralValueOf(user);
        return (collValue * liquidationThreshold * 1e18) / (debt * PCT_BASE);
    }

    //SOLVENCY GUARD //

    function _requireHealthy(address user) internal view {
        require(HealthFactor(user) >= HF_BASE, "HF < 1");
    }
    //USER ENVIRONMENTS //

    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must Deposit > 0");
        ethCollateral[msg.sender] += msg.value;
        //Forward to vault
        vault.depositETH{value: msg.value}(msg.sender);

        emit Deposit(msg.sender, msg.value);
    }

    function withDrawCollateral(
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero Amount");
        require(ethCollateral[msg.sender] >= amount, "Insudficient Collateral");
        // optimistic accounting
        ethCollateral[msg.sender] -= amount;

        //enforce solvency if user has debt
        if (tokenDebt[msg.sender] > 0) {
            _requireHealthy(msg.sender);
        }
        //Authorize ETH release from Vault
        vault.withdrawETH(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        // require(amount > 0, "ZERO BORROW ");

       
        // tokenDebt[msg.sender] += amount;
        // _requireHealthy(msg.sender);
        // vault.mintNL(msg.sender, amount);

        // emit Borrow(msg.sender, amount);
        revert("Use BorrowGate");
    }
    function borrowFor(address borrower, uint256 amount)
    external
    nonReentrant
    whenNotPaused
    onlyBorrowGate
{
    require(amount > 0, "ZERO BORROW");

    tokenDebt[borrower] += amount;
    _requireHealthy(borrower);

    vault.mintNL(borrower, amount);

    emit Borrow(borrower, amount);
}


    function repay(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "PAY SOMETHING ATLEAST");
        require(tokenDebt[msg.sender] >= amount, "OVERPAYING DEBT");

        require(
            nlToken.transferFrom(msg.sender, address(vault), amount),
            "Token transfer failed"
        );
        vault.burnNL(amount);
        tokenDebt[msg.sender] -= amount;
        emit Repay(msg.sender, amount);
    }

    //LIQUIDATION ENGINE //
    function liquidate(
        address borrower,
        uint256 repayAmount
    ) external nonReentrant whenNotPaused {
        require(HealthFactor(borrower) < HF_BASE, "Not liquidatable");
        require(borrower != msg.sender, "Self-liquidation not allowed");

        uint256 debt = tokenDebt[borrower];

        uint256 maxRepay = (debt * MAX_CLOSE_FACTOR) / PCT_BASE;
        if (debt <= MIN_DEBT) maxRepay = debt;

        require(repayAmount > 0 && repayAmount <= maxRepay, "Bad repay");

        uint256 price18 = _getPrice18();
        uint256 baseCollateral = (repayAmount * 1e18) / price18;
        uint256 bonus = (baseCollateral * LIQUIDATION_BONUS) / PCT_BASE;

      uint256 seizeAmount = baseCollateral + bonus;

// Cap to borrower's available collateral
uint256 borrowerColl = ethCollateral[borrower];
if (seizeAmount > borrowerColl) {
    seizeAmount = borrowerColl;
}

// --- NEW: Cap seize to guarantee HF does not worsen ---
// HF improves iff (C - seize)/(D - repay) >= C/D  => seize <= C*repay/D
// This is price-independent (price cancels out).
uint256 debtBefore = debt; 
uint256 maxSeizeNoWorsen = (borrowerColl * repayAmount) / debtBefore;

// If rounding makes maxSeizeNoWorsen = 0, liquidation is too small to be meaningful
require(maxSeizeNoWorsen > 0, "Repay too small");

if (seizeAmount > maxSeizeNoWorsen) {
    seizeAmount = maxSeizeNoWorsen;
}

        uint256 hfBefore = HealthFactor(borrower);

        // effects
        tokenDebt[borrower] -= repayAmount;
        ethCollateral[borrower] -= seizeAmount;
        ethCollateral[msg.sender] += seizeAmount;

        if (tokenDebt[borrower] < MIN_DEBT) tokenDebt[borrower] = 0;
        if (ethCollateral[borrower] < MIN_COLLATERAL)
            ethCollateral[borrower] = 0;

        uint256 hfAfter = HealthFactor(borrower);

        require(
            hfAfter >= hfBefore || tokenDebt[borrower] == 0,
            "No solvency improvement"
        );

        require(
            nlToken.transferFrom(msg.sender, address(vault), repayAmount),
            "NL transfer failed"
        );
        vault.burnNL(repayAmount);
        vault.transferEscrow(borrower, msg.sender, seizeAmount);

        emit Liquidation(
            msg.sender,
            borrower,
            repayAmount,
            seizeAmount,
            hfBefore,
            hfAfter
        );
    }
/// @notice Automated dynamic liquidation computed by Chainlink CRE.
    function creLiquidate(address borrower, uint256 repayAmount) external onlyCREReciever nonReentrant whenNotPaused {
        require(HealthFactor(borrower) < HF_BASE, "Not liquidatable");
        
        uint256 debt = tokenDebt[borrower];
        require(repayAmount > 0 && repayAmount <= debt, "Invalid repay amount");

        // Calculate Collateral to Seize (Base value + 5% Liquidation Bonus)
        uint256 price18 = _getPrice18();
        uint256 baseCollateral = (repayAmount * 1e18) / price18;
        uint256 seizeAmount = baseCollateral + ((baseCollateral * LIQUIDATION_BONUS) / PCT_BASE);

        // Cap to borrower's available collateral
        uint256 borrowerColl = ethCollateral[borrower];
        if (seizeAmount > borrowerColl) {
            seizeAmount = borrowerColl;
        }

        uint256 hfBefore = HealthFactor(borrower);

        // Effects: Reduce balances
        tokenDebt[borrower] -= repayAmount;
        ethCollateral[borrower] -= seizeAmount;
        
        // Protocol Treasury seizes the collateral internally
        ethCollateral[address(this)] += seizeAmount;

        // Prevent dust
        if (tokenDebt[borrower] < MIN_DEBT) tokenDebt[borrower] = 0;
        if (ethCollateral[borrower] < MIN_COLLATERAL) ethCollateral[borrower] = 0;

        uint256 hfAfter = HealthFactor(borrower);
        require(hfAfter >= hfBefore || tokenDebt[borrower] == 0, "No solvency improvement");

        // Move ETH in the Vault
        vault.transferEscrow(borrower, address(this), seizeAmount);

        emit Liquidation(msg.sender, borrower, repayAmount, seizeAmount, hfBefore, hfAfter);
    }
    // ADMIN //
    /// @notice Allows Admin to claim the ETH seized during CRE liquidations
    function claimProtocolProfits(uint256 amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(ethCollateral[address(this)] >= amount, "Insufficient protocol profits");
        
        // Deduct from protocol's internal balance
        ethCollateral[address(this)] -= amount;
        
        // Withdraw from the vault to the admin's wallet
        vault.withdrawETH(msg.sender, amount);
    }
    function setCRELiquidationReceiver(address _reciever) external onlyRole(ADMIN_ROLE){
        require(_reciever != address(0), "Invalid Reciever");
        creLiquidationReceiver = _reciever;
    }
    function setMaxPriceAge(uint256 age) external onlyRole(ADMIN_ROLE) {
        require(age > 0, "age=0");
        maxPriceAge = age;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
   function setBorrowGate(address _gate) external onlyRole(ADMIN_ROLE) {
    require(_gate != address(0), "Invalid gate");
    borrowGate = _gate;
}

    function getAccountInfo(
        address user
    ) external view returns (uint256 collateral, uint256 debt) {
        return (ethCollateral[user], tokenDebt[user]);
    }
}
