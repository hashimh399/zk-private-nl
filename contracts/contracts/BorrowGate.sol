// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./LendingPool.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BorrowGate is AccessControl, ReentrancyGuard {

    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    LendingPool public pool;

    uint256 public nextRequestId;

    struct BorrowRequest {
        address borrower;
        uint256 amount;
        bool approved;
        bool executed;
    }

    mapping(uint256 => BorrowRequest) public requests;

    event BorrowRequested(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amount
    );

    event BorrowExecuted(uint256 indexed requestId);

    constructor(address admin, address _pool) {
        _grantRole(ADMIN_ROLE, admin);
        pool = LendingPool(_pool);
    }

    function requestBorrow(uint256 amount) external nonReentrant {
        require(amount > 0, "ZERO");

        uint256 requestId = nextRequestId++;

        requests[requestId] = BorrowRequest({
            borrower: msg.sender,
            amount: amount,
            approved: false,
            executed: false
        });

        emit BorrowRequested(requestId, msg.sender, amount);
    }

    function approveBorrow(uint256 requestId) external onlyRole(ADMIN_ROLE) {
        requests[requestId].approved = true;
    }

    function executeBorrow(uint256 requestId) external nonReentrant {
        BorrowRequest storage r = requests[requestId];

        require(r.borrower == msg.sender, "Not borrower");
        require(r.approved, "Not approved");
        require(!r.executed, "Already executed");

        r.executed = true;

        pool.borrowFor(msg.sender, r.amount);

        emit BorrowExecuted(requestId);
    }
}
