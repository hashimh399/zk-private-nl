// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

/*
*   MockPriceFeed will be the local price feed 'oracle' used for unit testing.
*   The contract simulates how we extract the data from the oracle and use it
*   accordingly.
*/
contract MockPriceFeed is AggregatorV3Interface {
    uint8 private _decimals;
    int256 private _answer;
    uint80 private _rid = 1;
    uint256 private _t;
    uint80 private _answeredInRound;

    //When deploying the contract locally, d will be the decimal places (i.e. 8), initial will be value of the token.
    constructor(uint8 d, int256 initial) {
        _decimals = d;
        _answer = initial;
        _t = block.timestamp;
        _answeredInRound = _rid;
    }

    //Returns the decimal value of the token
    function decimals() external view returns (uint8) {
        return _decimals;
    }

    //Returns a set of data: _rid (round id, should be latest), answer(in our context, the price), _t (timestamp when the round started/updated), and round id return (should be same as round id if healthy).
    //For more information reference Chainlink API documentation (https://docs.chain.link/data-feeds/api-reference#getrounddata)
    function latestRoundData() external view returns (
        uint80, int256, uint256, uint256, uint80
    ) {
        return (_rid, _answer, _t, _t, _answeredInRound);
    }

    //For testing purposes, we'd like to update the price.
    function updateAnswer(int256 a) external {
        _answer = a;
        _rid++;
        _t = block.timestamp;
        _answeredInRound = _rid; // normal behavior: answeredInRound == roundId
    }

    //For testing stale data scenarios.
    function setTimestamp(uint256 newTimestamp) external {
        _t = newTimestamp;
        _rid++;
        _answeredInRound = _rid; // keep consistent unless overridden
    }

    //For testing different feed decimal configurations.
    function setDecimals(uint8 d) external {
        _decimals = d;
    }

    //For testing answeredInRound edge cases (e.g., answeredInRound < roundId).
    function setAnsweredInRound(uint80 air) external {
        _answeredInRound = air;
    }
}
