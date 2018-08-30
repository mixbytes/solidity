// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import '../security/ArgumentsChecker.sol';
import '../token/MintableToken.sol';
import './IInvestmentsWalletConnector.sol';
import './ICrowdsaleStat.sol';
import 'openzeppelin-solidity/contracts/ReentrancyGuard.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

contract ISimpleCrowdsaleBase {
  /// @dev says if crowdsale time bounds must be checked
  function mustApplyTimeCheck(address /*investor*/, uint256 /*payment*/) view internal returns (bool);

  /// @notice whether to apply hard cap check logic via getMaximumFunds() method 
  function hasHardCap() view internal returns (bool);

  /// @notice maximum investments to be accepted during pre-ICO
  function getMaximumFunds() internal view returns (uint256);

  /// @notice minimum amount of funding to consider crowdsale as successful
  function getMinimumFunds() internal view returns (uint256);

  /// @notice start time of the pre-ICO
  function getStartTime() internal view returns (uint256);

  /// @notice end time of the pre-ICO
  function getEndTime() internal view returns (uint256);

  /// @notice minimal amount of investment
  function getMinInvestment() public view returns (uint256);

  /// @dev calculates token amount for given investment
  function calculateTokens(address investor, uint256 payment, uint256 extraBonuses) internal view returns (uint256);
}

/// @title Base contract for simple crowdsales
contract SimpleCrowdsaleBase is ArgumentsChecker, ReentrancyGuard, IInvestmentsWalletConnector, ICrowdsaleStat, ISimpleCrowdsaleBase {
    using SafeMath for uint256;

    event FundTransfer(address backer, uint256 amount, bool isContribution);

    constructor (address token)
        public
        validAddress(token)
    {
        m_token = MintableToken(token);
    }


    // PUBLIC interface: payments

    // fallback function as a shortcut
    function() external payable {
        require(0 == msg.data.length);
        buy();  // only internal call here!
    }

    /// @notice crowdsale participation
    function buy() public payable {     // dont mark as external!
        buyInternal(msg.sender, msg.value, 0);
    }


    // INTERNAL

    /// @dev payment processing
    function buyInternal(address investor, uint256 payment, uint256 extraBonuses)
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

        uint256 startingWeiCollected = getWeiCollected();
        uint256 startingInvariant = address(this).balance.add(startingWeiCollected);

        uint256 change;
        if (hasHardCap()) {
            // return or update payment if needed
            uint256 paymentAllowed = getMaximumFunds().sub(getWeiCollected());
            assert(0 != paymentAllowed);

            if (paymentAllowed < payment) {
                change = payment.sub(paymentAllowed);
                payment = paymentAllowed;
            }
        }

        // issue tokens
        uint256 tokens = calculateTokens(investor, payment, extraBonuses);
        m_token.mint(investor, tokens);
        m_tokensMinted += tokens;

        // record payment
        storeInvestment(investor, payment);
        assert((!hasHardCap() || getWeiCollected() <= getMaximumFunds()) && getWeiCollected() > startingWeiCollected);
        emit FundTransfer(investor, payment, true);

        if (hasHardCap() && getWeiCollected() == getMaximumFunds())
            finish();

        if (change > 0)
            investor.transfer(change);

        assert(startingInvariant == address(this).balance.add(getWeiCollected()).add(change));
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
    function mustApplyTimeCheck(address /*investor*/, uint256 /*payment*/) view internal returns (bool) {
        return true;
    }

    /// @notice whether to apply hard cap check logic via getMaximumFunds() method 
    function hasHardCap() view internal returns (bool) {
        return getMaximumFunds() != 0;
    }

    /// @dev to be overridden in tests
    function getCurrentTime() internal view returns (uint256) {
        return now;
    }


    /// @notice minimal amount of investment
    function getMinInvestment() public view returns (uint256) {
        return 10 finney;
    }



    // ICrowdsaleStat

    function getWeiCollected() public view returns (uint256) {
        return getTotalInvestmentsStored();
    }

    /// @notice amount of tokens minted (NOT equal to totalSupply() in case token is reused!)
    function getTokenMinted() public view returns (uint256) {
        return m_tokensMinted;
    }


    // FIELDS

    /// @dev contract responsible for token accounting
    MintableToken public m_token;

    uint256 m_tokensMinted;

    bool m_finished = false;
}
