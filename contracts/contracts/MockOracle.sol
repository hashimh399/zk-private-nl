/*
TRUST ASSUMPTIONS:

- Oracle is assumed manipulation-resistant.
- Oracle updates must not occur in same tx as borrow/liquidate.
- Admin is expected to pause protocol during oracle incidents.
*/
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockOracle is AccessControl {
    uint256 public price;
    uint8 public constant decimals = 8;
    uint256 public lastUpdated;

    constructor(uint256 _initialPrice) {
        price = _initialPrice;
        lastUpdated = block.timestamp;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function getLatestPrice() external view returns (uint256, uint256) {
        return (price, lastUpdated);
    }

    function setPrice(uint256 _newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        price = _newPrice;
        lastUpdated = block.timestamp;
    }
}
