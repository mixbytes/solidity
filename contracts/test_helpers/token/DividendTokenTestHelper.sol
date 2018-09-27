// Copyright (C) 2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import '../../token/DividendToken.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol';


/// @title Test helper for MintableMultiownedToken, DONT use it in production!
contract DividendTokenTestHelper is DividendToken, MintableToken {
    event EmissionHappened(uint256 totalSupply, uint256 totalBalanceWas);

    string public constant name = 'DVDND';
    string public constant symbol = 'DVDND';
    uint8 public constant decimals = 18;

    function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
        payDividendsTo(_to);

        bool res = super.mint(_to, _amount);

        m_emissions.push(EmissionInfo({
            totalSupply: totalSupply(),
            totalBalanceWas: m_totalDividends
        }));

        emit EmissionHappened(totalSupply(), m_totalDividends);
        return res;
    }

    function getMaxIterationsForRequestDividends() internal pure returns (uint256) {
        return 9;
    }
}
