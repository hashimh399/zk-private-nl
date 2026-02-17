// contracts/interfaces/ILendingPoolGateable.sol
pragma solidity ^0.8.20;

interface ILendingPoolGateable {
  function borrow(uint256 amount) external;

  // minimal addition: BorrowGate calls this
  function borrowFor(address borrower, uint256 amount) external;

  // for snapshotting at request time (add if you don't already have something equivalent)
  function getAccountSnapshot(address user)
    external
    view
    returns (uint256 collateralValue, uint256 debtValue, uint256 hf1e18);
}
