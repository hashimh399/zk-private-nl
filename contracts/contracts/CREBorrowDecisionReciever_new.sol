// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReceiverTemplate} from "./chainlink/ReceiverTemplate.sol";
import {BorrowApprovalRegistry} from "./BorrowApprovalRegistry.sol";

contract CREBorrowDecisionReceiver is ReceiverTemplate {
  BorrowApprovalRegistry public immutable registry;

  error InvalidDecision();

  constructor(address forwarder, address registry_, address owner_)
    ReceiverTemplate(forwarder)
  {
    registry = BorrowApprovalRegistry(registry_);
    _transferOwnership(owner_);
  }

  function _processReport(bytes calldata report) internal override {
    (
      uint256 requestId,
      uint256 nullifier,
      uint8 approved,
      uint8 reasonCode,
      uint16 fearGreed,
      uint16 ltvBps,
      uint256 hfAfter1e18,
      uint16 llmRiskScoreBp,
      uint8 llmRec,
      bytes32 llmResponseHash
    ) = abi.decode(
      report,
      (uint256,uint256,uint8,uint8,uint16,uint16,uint256,uint16,uint8,bytes32)
    );

    if (approved > 1) revert InvalidDecision();

    registry.recordDecision(
      requestId,
      nullifier,
      approved == 1,
      reasonCode,
      fearGreed,
      ltvBps,
      hfAfter1e18,
      llmRiskScoreBp,
      llmRec,
      llmResponseHash
    );
  }
}
