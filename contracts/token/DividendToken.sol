// Copyright (C) 2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;

import 'zeppelin-solidity/contracts/token/StandardToken.sol';

import '../ownership/multiowned.sol';


contract DividendToken is StandardToken {
    event PayDividend(address indexed to, uint256 amount);
    event Deposit(address indexed sender, uint value);

    /// @dev parameters of an extra token emission
    struct EmissionInfo {
        // new totalSupply after emission happened
        uint totalSupply;

        // total balance of Ether stored at the contract when emission happened
        uint totalBalanceWas;
    }

    function DividendToken() public
    {
        m_emissions.push(EmissionInfo({
            totalSupply: totalSupply,
            totalBalanceWas: this.balance
        }));
    }

    function() external payable {
        if (msg.value > 0) {
            Deposit(msg.sender, msg.value);
            m_totalDividends = m_totalDividends.add(msg.value);
        }
    }

    /// @notice Request dividends for current account.
    function requestDividends() public {
        payDividendsTo(msg.sender);
    }

    /// @notice hook on standard ERC20#transfer to pay dividends
    function transfer(address _to, uint256 _value) public returns (bool) {
        payDividendsTo(msg.sender);
        payDividendsTo(_to);
        return super.transfer(_to, _value);
    }

    /// @notice hook on standard ERC20#transferFrom to pay dividends
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        payDividendsTo(_from);
        payDividendsTo(_to);
        return super.transferFrom(_from, _to, _value);
    }

    /// @dev adds dividends to the account _to
    function payDividendsTo(address _to) internal {
        var (hasNewDividends, dividends) = calculateDividendsFor(_to);
        if (!hasNewDividends)
            return;

        if (0 != dividends) {
            _to.transfer(dividends);
            PayDividend(_to, dividends);
        }

        m_lastAccountEmission[_to] = getLastEmissionNum();
        m_lastDividents[_to] = m_totalDividends;
    }

    /// @dev calculates dividends for the account _for
    /// @return (true if state has to be updated, dividend amount (could be 0!))
    function calculateDividendsFor(address _for) constant internal returns (bool hasNewDividends, uint dividends) {
        uint256 lastEmissionNum = getLastEmissionNum();
        uint256 lastAccountEmissionNum = m_lastAccountEmission[_for];
        assert(lastAccountEmissionNum <= lastEmissionNum);

        uint lastBalanceWasWhenPayed = m_lastDividents[_for];

        // If no new ether was collected since last dividends claim
        if (m_totalDividends <= lastBalanceWasWhenPayed)
            return (false, 0);

        uint256 initialBalance = balances[_for];    // beware of recursion!

        // if no tokens owned by account
        if (0 == initialBalance)
            return (true, 0);

        // We start with last processed emission because some ether could be collected before next emission
        // we pay all remaining ether collected and continue with all the next emissions
        for (uint256 emissionToProcess = lastAccountEmissionNum; emissionToProcess <= lastEmissionNum; emissionToProcess++) {
            EmissionInfo storage emission = m_emissions[emissionToProcess];

            if (0 == emission.totalSupply)
                continue;

            uint totalEtherDuringEmission;
            if (emissionToProcess == lastEmissionNum) {
                totalEtherDuringEmission = m_totalDividends - lastBalanceWasWhenPayed;
            }
            else {
                totalEtherDuringEmission = m_emissions[emissionToProcess+1].totalBalanceWas - lastBalanceWasWhenPayed;
            }

            uint256 dividend = totalEtherDuringEmission.mul(initialBalance).div(emission.totalSupply);

            dividends = dividends.add(dividend);
        }

        return (true, dividends);
    }

    function getLastEmissionNum() private constant returns (uint256) {
        return m_emissions.length - 1;
    }

    /// @notice record of issued dividend emissions
    EmissionInfo[] m_emissions;

    /// @dev for each token holder: last emission (index in m_emissions) which was processed for this holder
    mapping(address => uint256) m_lastAccountEmission;

    /// @dev for each token holder: last ether balance was when requested dividends
    mapping(address => uint256) m_lastDividents;


    uint256 m_totalDividends;
}