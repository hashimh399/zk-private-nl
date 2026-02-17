// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BorrowApprovalRegistry is Ownable {
  struct Decision {
    bool exists;
    bool approved;
    uint8 reasonCode;
    uint40 decidedAt;
    uint256 requestId;

    // audit / telemetry fields (optional)
    uint16 fearGreed;
    uint16 ltvBps;
    uint256 hfAfter1e18;
    uint16 llmRiskScoreBp;
    uint8 llmRec;
    bytes32 llmResponseHash;
  }

  // nullifier => decision
  mapping(uint256 => Decision) public decisions;

  address public receiver;

  event ReceiverSet(address indexed receiver);
  event DecisionRecorded(
    uint256 indexed nullifier,
    uint256 indexed requestId,
    bool approved,
    uint8 reasonCode
  );

  error NotReceiver();
  error AlreadyDecided();

  constructor(address owner_) Ownable(owner_) {}

  function setReceiver(address receiver_) external onlyOwner {
    receiver = receiver_;
    emit ReceiverSet(receiver_);
  }

  function recordDecision(
    uint256 requestId,
    uint256 nullifier,
    bool approved,
    uint8 reasonCode,
    uint16 fearGreed,
    uint16 ltvBps,
    uint256 hfAfter1e18,
    uint16 llmRiskScoreBp,
    uint8 llmRec,
    bytes32 llmResponseHash
  ) external {
    if (msg.sender != receiver) revert NotReceiver();

    Decision storage d = decisions[nullifier];
    if (d.exists) revert AlreadyDecided();

    d.exists = true;
    d.approved = approved;
    d.reasonCode = reasonCode;
    d.decidedAt = uint40(block.timestamp);
    d.requestId = requestId;

    d.fearGreed = fearGreed;
    d.ltvBps = ltvBps;
    d.hfAfter1e18 = hfAfter1e18;
    d.llmRiskScoreBp = llmRiskScoreBp;
    d.llmRec = llmRec;
    d.llmResponseHash = llmResponseHash;

    emit DecisionRecorded(nullifier, requestId, approved, reasonCode);
  }

  function isApproved(uint256 nullifier, uint256 requestId) external view returns (bool) {
    Decision storage d = decisions[nullifier];
    return d.exists && d.requestId == requestId && d.approved;
  }
}
