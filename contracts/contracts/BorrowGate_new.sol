// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILendingPoolGateable} from "./interfaces/ILendingPoolGateable.sol";
import {IZKPassVerifier} from "./interfaces/IZKPassVerifier.sol";
import {IZKPassRootManager} from "./interfaces/IZKPassRootManager.sol";
import {BorrowApprovalRegistry} from "./BorrowApprovalRegistry.sol";

contract BorrowGate is ReentrancyGuard, Ownable {
  ILendingPoolGateable public immutable pool;
  BorrowApprovalRegistry public immutable registry;
  IZKPassVerifier public immutable verifier;
  IZKPassRootManager public immutable rootManager;

  uint256 public nextRequestId;

  mapping(uint256 => bool) public nullifierConsumed;

  struct BorrowRequest {
    address borrower;
    address asset;
    uint256 amount;

    uint256 nullifier;
    uint256 nonce;
    uint256 merkleRoot;

    // snapshot for CRE reads
    uint256 collateralValue;
    uint256 debtValue;
    uint256 hfAfter1e18;
    uint16 ltvAfterBps;

    uint40 createdAt;
    bool executed;
  }

  mapping(uint256 => BorrowRequest) internal _requests;

  event BorrowRequested(
    uint256 indexed requestId,
    address indexed borrower,
    uint256 indexed nullifier,
    uint256 amount,
    address asset
  );

  event BorrowExecuted(
    uint256 indexed requestId,
    address indexed borrower,
    uint256 indexed nullifier,
    uint256 amount,
    address asset
  );

  error InvalidRoot();
  error InvalidProof();
  error NullifierConsumed();
  error NotBorrower();
  error AlreadyExecuted();
  error NotApproved();

  constructor(
    address owner_,
    address pool_,
    address registry_,
    address verifier_,
    address rootManager_
  ) Ownable(owner_) {
    pool = ILendingPoolGateable(pool_);
    registry = BorrowApprovalRegistry(registry_);
    verifier = IZKPassVerifier(verifier_);
    rootManager = IZKPassRootManager(rootManager_);
  }

  /// View for CRE workflow
  function getBorrowRequest(uint256 requestId)
    external
    view
    returns (
      address borrower,
      address asset,
      uint256 amount,
      uint256 nullifier,
      uint256 collateralValue,
      uint256 debtValue,
      uint256 hfAfter1e18,
      uint16 ltvAfterBps
    )
  {
    BorrowRequest storage r = _requests[requestId];
    return (
      r.borrower,
      r.asset,
      r.amount,
      r.nullifier,
      r.collateralValue,
      r.debtValue,
      r.hfAfter1e18,
      r.ltvAfterBps
    );
  }

  function requestBorrow(
    address asset,
    uint256 amount,
    uint256 nonce,
    uint256 merkleRoot,
    uint256 nullifier,
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[4] calldata publicSignals
  ) external nonReentrant returns (uint256 requestId) {
    // publicSignals = [root, nullifier, borrowerAddrField, nonce]
    // Ensure caller-bound proof
    if (publicSignals[2] != uint256(uint160(msg.sender))) revert InvalidProof();
    if (publicSignals[3] != nonce) revert InvalidProof();
    if (publicSignals[0] != merkleRoot) revert InvalidProof();
    if (publicSignals[1] != nullifier) revert InvalidProof();

    if (merkleRoot != rootManager.currentRoot()) revert InvalidRoot();
    if (nullifierConsumed[nullifier]) revert NullifierConsumed();

    bool ok = verifier.verifyProof(a, b, c, publicSignals);
    if (!ok) revert InvalidProof();

    // Snapshot onchain context (requires pool view)
    (uint256 collateralValue, uint256 debtValue, uint256 hfBefore) =
      pool.getAccountSnapshot(msg.sender);

    // Conservative derived metrics for CRE:
    // ltvAfterBps = (debtAfter / collateral) * 10_000
    uint256 debtAfter = debtValue + amount;
    uint16 ltvAfterBps = collateralValue == 0
      ? type(uint16).max
      : uint16((debtAfter * 10_000) / collateralValue);

    // For hfAfter snapshot: if your pool already has a view for hfAfter, use that.
    // Otherwise store hfBefore here and let CRE use it as a proxy.
    uint256 hfAfter1e18 = hfBefore; // replace with real preview if available

    requestId = nextRequestId++;
    _requests[requestId] = BorrowRequest({
      borrower: msg.sender,
      asset: asset,
      amount: amount,
      nullifier: nullifier,
      nonce: nonce,
      merkleRoot: merkleRoot,
      collateralValue: collateralValue,
      debtValue: debtValue,
      hfAfter1e18: hfAfter1e18,
      ltvAfterBps: ltvAfterBps,
      createdAt: uint40(block.timestamp),
      executed: false
    });

    emit BorrowRequested(requestId, msg.sender, nullifier, amount, asset);
  }

  function executeBorrow(uint256 requestId) external nonReentrant {
    BorrowRequest storage r = _requests[requestId];
    if (r.borrower != msg.sender) revert NotBorrower();
    if (r.executed) revert AlreadyExecuted();

    // Require CRE decision
    bool ok = registry.isApproved(r.nullifier, requestId);
    if (!ok) revert NotApproved();

    // Consume nullifier + execute
    r.executed = true;
    nullifierConsumed[r.nullifier] = true;

    pool.borrowFor(msg.sender, r.amount);

    emit BorrowExecuted(requestId, msg.sender, r.nullifier, r.amount, r.asset);
  }
}
