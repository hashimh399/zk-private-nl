// contracts/interfaces/IZKPassRootManager.sol
pragma solidity ^0.8.20;

interface IZKPassRootManager {
  function currentRoot() external view returns (uint256);
}
