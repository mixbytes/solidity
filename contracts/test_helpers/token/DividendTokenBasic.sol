// Copyright (C) 2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import '../../token/DividendToken.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

/// @title Test helper for MintableMultiownedToken, DONT use it in production!
contract DividendTokenBasic is DividendToken {
	using SafeMath for uint256;
  uint8 public decimals;

  constructor (uint256 initialTotalSupply, uint8 initialDecimals) public {
    decimals = initialDecimals;	
		mint(initialTotalSupply);
  }

	function mint(uint256 amount) internal {
		balances[msg.sender] = balances[msg.sender].add(amount);
    totalSupply_ = totalSupply_.add(amount);
		m_emissions.push(EmissionInfo({
			totalSupply: totalSupply(),
			totalBalanceWas: m_totalDividends
		}));
	}
}
