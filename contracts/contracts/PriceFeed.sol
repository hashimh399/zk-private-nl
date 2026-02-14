// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PriceFeed is AccessControl {
    error InvalidFeedAddress(address feed);
    error InvalidAggregator(address feed);
    error BadRound(address feed, uint80 roundId, uint80 answeredInRound);
    error BadAnswer(address feed, int256 answer);
    error StaleAnswer(address feed, uint256 updatedAt, uint256 maxAgeSeconds);

    bytes32 public constant DEVELOPER_ROLE = keccak256("DEVELOPER_ROLE");

    // 0 = allow stale (no staleness enforcement)
    uint256 public maxAgeSeconds;

    event MaxAgeUpdated(uint256 oldMaxAgeSeconds, uint256 newMaxAgeSeconds);

    constructor(uint256 initialMaxAgeSeconds, address admin, address developer) {
        maxAgeSeconds = initialMaxAgeSeconds;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DEVELOPER_ROLE, developer);
    }

    /// Only devs can change staleness settings (e.g., 30s, 60s, 15min).
    function setMaxAgeSeconds(uint256 newMaxAgeSeconds) external onlyRole(DEVELOPER_ROLE) {
        uint256 old = maxAgeSeconds;
        maxAgeSeconds = newMaxAgeSeconds;
        emit MaxAgeUpdated(old, newMaxAgeSeconds);
    }

    /// Plug-and-play: pass any Chainlink AggregatorV3 feed address (e.g., ETH/USD)
    /// Returns: answer, decimals, updatedAt
    function getDataFeed(address tokenFeed)
        public
        view
        returns (int256 answer, uint8 dec, uint256 updatedAt)
    {
        if (tokenFeed == address(0)) revert InvalidFeedAddress(tokenFeed);
        if (tokenFeed.code.length == 0) revert InvalidAggregator(tokenFeed);

        AggregatorV3Interface dataFeed = AggregatorV3Interface(tokenFeed);

        uint80 roundId;
        uint80 answeredInRound;

        try dataFeed.latestRoundData()
            returns (uint80 r, int256 a, uint256, uint256 u, uint80 air)
        {
            roundId = r;
            answer = a;
            updatedAt = u;
            answeredInRound = air;
        } catch {
            revert InvalidAggregator(tokenFeed);
        }

        // Basic safety checks: If Chainlink's aggregator is still computing the latest data but we received previous data.
        if (answeredInRound < roundId) revert BadRound(tokenFeed, roundId, answeredInRound);
        if (answer <= 0) revert BadAnswer(tokenFeed, answer);

        uint256 maxAge = maxAgeSeconds;
        //Check staleness
        if (maxAge != 0) {
            if (updatedAt == 0 || block.timestamp - updatedAt > maxAge) {
                revert StaleAnswer(tokenFeed, updatedAt, maxAge);
            }
        }

        dec = dataFeed.decimals();
        return (answer, dec, updatedAt);
    }
}
