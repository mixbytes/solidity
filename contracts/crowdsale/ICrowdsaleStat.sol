// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

/**
 * @title Basic crowdsale stat
 * @author Eenae
 */
contract ICrowdsaleStat {

    /// @notice amount of funds collected in wei
    function getWeiCollected() public view returns (uint256);

    /// @notice amount of tokens minted (NOT equal to totalSupply() in case token is reused!)
    function getTokenMinted() public view returns (uint256);
}
