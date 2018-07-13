// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;

import '../../token/DividendToken.sol';


/// @title Test helper for MintableMultiownedToken, DONT use it in production!
contract DividendTokenTestHelper is DividendToken {
    string public constant name = 'DVDND';
    string public constant symbol = 'DVDND';
    uint8 public constant decimals = 18;

    function DividendTokenTestHelper() {
        uint premintAmount = 50;
        totalSupply = totalSupply.add(premintAmount);
        balances[msg.sender] = balances[msg.sender].add(premintAmount);
        Transfer(address(0), msg.sender, premintAmount);

        m_emissions.push(EmissionInfo({
            totalSupply: totalSupply,
            totalBalanceWas: this.balance
        }));
    }
}
