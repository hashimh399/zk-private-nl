// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract BorrowApprovalRegistry is AccessControl {
    bytes32 public constant WRITER_ROLE = keccak256("WRITER_ROLE");

    struct Decision {
        bool decided;
        bool approved;
        bool rejected;
        uint8 reasonCode;
        uint40 decidedAt;
        uint16 riskScore;
        uint16 ltvBps;
    }

    mapping(bytes32 => Decision) public decisions;

    event DecisionWritten(
        bytes32 indexed nullifier,
        bool approved,
        bool rejected,
        uint8 reasonCode,
        uint16 riskScore,
        uint16 ltvBps
    );

    constructor(address admin, address writer) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (writer != address(0)) {
            _grantRole(WRITER_ROLE, writer);
        }
    }

    function isDecided(bytes32 nullifier) external view returns (bool) {
        return decisions[nullifier].decided;
    }

    function isApproved(bytes32 nullifier) external view returns (bool) {
        return decisions[nullifier].approved;
    }

    function isRejected(bytes32 nullifier) external view returns (bool) {
        return decisions[nullifier].rejected;
    }

    /// @notice Called by Receiver (CRE flow) or admin during testing.
    function writeDecision(
        bytes32 nullifier,
        bool approved,
        uint8 reasonCode,
        uint16 riskScore,
        uint16 ltvBps
    ) external onlyRole(WRITER_ROLE) {
        require(nullifier != bytes32(0), "NULLIFIER=0");

        Decision storage d = decisions[nullifier];
        require(!d.decided, "Already decided");

        d.decided = true;
        d.approved = approved;
        d.rejected = !approved;
        d.reasonCode = reasonCode;
        d.decidedAt = uint40(block.timestamp);
        d.riskScore = riskScore;
        d.ltvBps = ltvBps;

        emit DecisionWritten(nullifier, d.approved, d.rejected, reasonCode, riskScore, ltvBps);
    }
}
