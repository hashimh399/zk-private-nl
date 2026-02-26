// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface ILendingPool {
    // 🚨 Updated interface
    function creLiquidate(address borrower, uint256 repayAmount) external;
}

interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

contract CRELiquidationReceiver is AccessControl, IReceiver {
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    address public forwarder;
    ILendingPool public pool;

    constructor(address admin, address _pool, address _forwarder) {
        _grantRole(ADMIN_ROLE, admin);
        pool = ILendingPool(_pool);
        forwarder = _forwarder; 
    }

    modifier onlyForwarder() {
        require(msg.sender == forwarder, "Not CLI Forwarder");
        _;
    }

    function onReport(bytes calldata /*metadata*/, bytes calldata report) external override onlyForwarder {
        // 🚨 Decode both the address AND the dynamically computed repayAmount
        (address underwaterBorrower, uint256 optimalRepay) = abi.decode(report, (address, uint256));
        
        // Execute the targeted seizure
        pool.creLiquidate(underwaterBorrower, optimalRepay);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl, IERC165) returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || super.supportsInterface(interfaceId);
    }
}