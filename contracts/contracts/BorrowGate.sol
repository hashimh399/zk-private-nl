// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./LendingPool.sol";
import "./BorrowApprovalRegistry.sol";
import "./ZKPassVerifier.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BorrowGate is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    LendingPool public pool;
    BorrowApprovalRegistry public registry;
    Groth16Verifier public verifier;

    uint256 public nextRequestId;
    mapping(bytes32 => bool) public nullifierConsumed;

    bytes32 public currentRoot;
    mapping(bytes32 => bool) public validRoots;

    struct BorrowRequest {
        address borrower;
        uint256 amount;
        bytes32 nullifier;
        bool executed;
    }

    mapping(uint256 => BorrowRequest) public requests;

    event RootUpdated(bytes32 indexed root);

    event BorrowRequested(
        uint256 indexed requestId,
        address indexed borrower,
        bytes32 indexed nullifier,
        uint256 amount
    );

    event BorrowExecuted(uint256 indexed requestId, bytes32 indexed nullifier);

    constructor(
        address admin,
        address _pool,
        address _registry,
        address _verifier,
        bytes32 _root
    ) {
        _grantRole(ADMIN_ROLE, admin);
        pool = LendingPool(_pool);
        registry = BorrowApprovalRegistry(_registry);
        verifier = Groth16Verifier(_verifier);

        require(_root != bytes32(0), "root=0");
        currentRoot = _root;
        validRoots[_root] = true;
        emit RootUpdated(_root);
    }

    function setRegistry(address _registry) external onlyRole(ADMIN_ROLE) {
        registry = BorrowApprovalRegistry(_registry);
    }

    function setRoot(bytes32 newRoot) external onlyRole(ADMIN_ROLE) {
        require(newRoot != bytes32(0), "root=0");
        currentRoot = newRoot;
        validRoots[newRoot] = true;
        emit RootUpdated(newRoot);
    }

    function requestBorrow(
        uint256 amount,
        bytes32 root,
        bytes32 nullifier,
        uint256 nonce,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external nonReentrant {
        require(amount > 0, "ZERO");
        require(nullifier != bytes32(0), "NULLIFIER=0");
        require(!nullifierConsumed[nullifier], "NULLIFIER USED");
        require(!registry.isDecided(nullifier), "Already decided");

        // Root must be current/valid
        require(validRoots[root], "Invalid root");

        // pubSignals order MUST match circuit:
        // [root, nullifier, borrower, nonce]
        uint256[4] memory pubSignals = [
            uint256(root),
            uint256(nullifier),
            uint256(uint160(msg.sender)),
            nonce
        ];

        require(verifier.verifyProof(a, b, c, pubSignals), "Invalid ZK proof");

        uint256 requestId = nextRequestId++;

        requests[requestId] = BorrowRequest({
            borrower: msg.sender,
            amount: amount,
            nullifier: nullifier,
            executed: false
        });

        emit BorrowRequested(requestId, msg.sender, nullifier, amount);
    }

    function executeBorrow(uint256 requestId) external nonReentrant {
        BorrowRequest storage r = requests[requestId];

        require(r.borrower == msg.sender, "Not borrower");
        require(!r.executed, "Already executed");
        require(registry.isApproved(r.nullifier), "Not approved");

        r.executed = true;
        nullifierConsumed[r.nullifier] = true;

        pool.borrowFor(msg.sender, r.amount);

        emit BorrowExecuted(requestId, r.nullifier);
    }
}
