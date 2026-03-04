// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./BorrowApprovalRegistry.sol";

interface IReceiver is IERC165 {
  function onReport(bytes calldata metadata, bytes calldata report) external;
}

contract CREBorrowDecisionReceiver is AccessControl, IReceiver {
  bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

  address public forwarder;
  BorrowApprovalRegistry public registry;

  event ForwarderUpdated(address indexed forwarder);
  event RegistryUpdated(address indexed registry);

  constructor(address admin, address _registry, address _forwarder) {
    _grantRole(ADMIN_ROLE, admin);
    registry = BorrowApprovalRegistry(_registry);
    forwarder = _forwarder;
    emit RegistryUpdated(_registry);
    emit ForwarderUpdated(_forwarder);
  }

  function setForwarder(address _forwarder) external onlyRole(ADMIN_ROLE) {
    require(_forwarder != address(0), "Bad forwarder");
    forwarder = _forwarder;
    emit ForwarderUpdated(_forwarder);
  }

  function setRegistry(address _registry) external onlyRole(ADMIN_ROLE) {
    require(_registry != address(0), "Bad registry");
    registry = BorrowApprovalRegistry(_registry);
    emit RegistryUpdated(_registry);
  }

  modifier onlyForwarder() {
    require(msg.sender == forwarder, "Not forwarder");
    _;
  }

  /// @notice report ABI: (bytes32 nullifier, bool approved, uint8 reasonCode, uint16 riskScore, uint16 ltvBps)
  function onReport(bytes calldata /*metadata*/, bytes calldata report) external override onlyForwarder {
    (bytes32 nullifier, bool approved, uint8 reasonCode, uint16 riskScore, uint16 ltvBps) =
      abi.decode(report, (bytes32, bool, uint8, uint16, uint16));

    registry.writeDecision(nullifier, approved, reasonCode, riskScore, ltvBps);
  }

  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(AccessControl, IERC165)
    returns (bool)
  {
    return interfaceId == type(IReceiver).interfaceId || super.supportsInterface(interfaceId);
  }
}
