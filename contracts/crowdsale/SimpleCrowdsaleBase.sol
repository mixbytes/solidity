// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;

import '../security/ArgumentsChecker.sol';
import '../token/MintableMultiownedToken.sol';
import './IInvestmentsWalletConnector.sol';
import './ICrowdsaleStat.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';


/// @title Base contract for simple crowdsales
contract SimpleCrowdsaleBase is ArgumentsChecker, ReentrancyGuard, IInvestmentsWalletConnector, ICrowdsaleStat {
    using SafeMath for uint256;

    event FundTransfer(address backer, uint amount, bool isContribution);

    function SimpleCrowdsaleBase(address token)
        validAddress(token)
    {
        m_token = MintableMultiownedToken(token);
    }


    // PUBLIC interface: payments

    // fallback function as a shortcut
    function() payable {
        require(0 == msg.data.length);
        buy();  // only internal call here!
    }

    /// @notice crowdsale participation
    function buy() public payable {     // dont mark as external!
        buyInternal(msg.sender, msg.value, 0);
    }


    // INTERNAL

    /// @dev payment processing
    function buyInternal(address investor, uint payment, uint extraBonuses)
        internal
        nonReentrant
    {
        require(payment >= getMinInvestment());
        require(getCurrentTime() >= getStartTime() || ! mustApplyTimeCheck(investor, payment) /* for final check */);
        if (getCurrentTime() >= getEndTime())
            finish();

        if (m_finished) {
            // saving provided gas
            investor.transfer(payment);
            return;
        }

        uint startingWeiCollected = getWeiCollected();
        uint startingInvariant = this.balance.add(startingWeiCollected);

        uint change;
        if (hasHardCap()) {
            // return or update payment if needed
            uint paymentAllowed = getMaximumFunds().sub(getWeiCollected());
            assert(0 != paymentAllowed);

            if (paymentAllowed < payment) {
                change = payment.sub(paymentAllowed);
                payment = paymentAllowed;
            }
        }

        // issue tokens
        uint tokens = calculateTokens(investor, payment, extraBonuses);
        m_token.mint(investor, tokens);
        m_tokensMinted += tokens;

        // record payment
        storeInvestment(investor, payment);
        assert((getWeiCollected() <= getMaximumFunds() || !hasHardCap()) && getWeiCollected() > startingWeiCollected);
        FundTransfer(investor, payment, true);

        if (getWeiCollected() == getMaximumFunds())
            finish();

        if (change > 0)
            investor.transfer(change);

        assert(startingInvariant == this.balance.add(getWeiCollected()).add(change));
    }

    function finish() internal {
        if (m_finished)
            return;

        if (getWeiCollected() >= getMinimumFunds())
            wcOnCrowdsaleSuccess();
        else
            wcOnCrowdsaleFailure();

        m_finished = true;
    }


    // Other pluggables

    /// @dev says if crowdsale time bounds must be checked
    function mustApplyTimeCheck(address /*investor*/, uint /*payment*/) constant internal returns (bool) {
        return true;
    }

    /// @notice whether to apply hard cap check logic via getMaximumFunds() method 
    function hasHardCap() constant internal returns (bool) {
        return getMaximumFunds() != 0;
    }

    /// @dev to be overridden in tests
    function getCurrentTime() internal constant returns (uint) {
        return now;
    }

    /// @notice maximum investments to be accepted during pre-ICO
    function getMaximumFunds() internal constant returns (uint);

    /// @notice minimum amount of funding to consider crowdsale as successful
    function getMinimumFunds() internal constant returns (uint);

    /// @notice start time of the pre-ICO
    function getStartTime() internal constant returns (uint);

    /// @notice end time of the pre-ICO
    function getEndTime() internal constant returns (uint);

    /// @notice minimal amount of investment
    function getMinInvestment() public constant returns (uint) {
        return 10 finney;
    }

    /// @dev calculates token amount for given investment
    function calculateTokens(address investor, uint payment, uint extraBonuses) internal constant returns (uint);


    // ICrowdsaleStat

    function getWeiCollected() public constant returns (uint) {
        return getTotalInvestmentsStored();
    }

    /// @notice amount of tokens minted (NOT equal to totalSupply() in case token is reused!)
    function getTokenMinted() public constant returns (uint) {
        return m_tokensMinted;
    }


    // FIELDS

    /// @dev contract responsible for token accounting
    MintableMultiownedToken public m_token;

    uint m_tokensMinted;

    bool m_finished = false;
}
