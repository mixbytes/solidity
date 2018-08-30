// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import '../../token/MintableEmissionCapableMultiownedToken.sol';
import '../../token/CirculatingToken.sol';


/// @title Test helper for MintableMultiownedToken, DONT use it in production!
contract MintableMultiownedCirculatingTokenTestHelper is CirculatingToken, MintableEmissionCapableMultiownedToken {

    constructor(address[] _owners, uint256 _signatures, address _minter)
        public
        MintableEmissionCapableMultiownedToken(_owners, _signatures, _minter)
    {
    }

    function emission(uint256 _weiToEmit) external onlymanyowners(keccak256(msg.data)) {
        emissionInternal(_weiToEmit);
    }

    /// @dev Allows token transfers
    function startCirculation() external onlyController {
        assert(enableCirculation());    // must be called once
    }
}
