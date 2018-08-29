// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import '../ownership/MultiownedControlled.sol';
import '../security/ArgumentsChecker.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import 'openzeppelin-solidity/contracts/ReentrancyGuard.sol';


/// @title registry of funds sent by investors
contract FundsRegistry is ArgumentsChecker, MultiownedControlled, ReentrancyGuard {
    using SafeMath for uint256;

    enum State {
        // gathering funds
        GATHERING,
        // returning funds to investors
        REFUNDING,
        // funds can be pulled by owners
        SUCCEEDED
    }

    event StateChanged(State _state);
    event Invested(address indexed investor, uint256 amount);
    event EtherSent(address indexed to, uint256 value);
    event RefundSent(address indexed to, uint256 value);


    modifier requiresState(State _state) {
        require(m_state == _state);
        _;
    }


    // PUBLIC interface

    constructor (address[] _owners, uint256 _signaturesRequired, address _controller)
        public
        MultiownedControlled(_owners, _signaturesRequired, _controller)
    {
    }

    /// @dev performs only allowed state transitions
    function changeState(State _newState)
        external
        onlyController
    {
        assert(m_state != _newState);

        if (State.GATHERING == m_state) {   assert(State.REFUNDING == _newState || State.SUCCEEDED == _newState); }
        else assert(false);

        m_state = _newState;
        emit StateChanged(m_state);
    }

    /// @dev records an investment
    function invested(address _investor)
        external
        payable
        onlyController
        requiresState(State.GATHERING)
    {
        uint256 amount = msg.value;
        require(0 != amount);
        assert(_investor != m_controller);

        // register investor
        if (0 == m_weiBalances[_investor])
            m_investors.push(_investor);

        // register payment
        totalInvested = totalInvested.add(amount);
        m_weiBalances[_investor] = m_weiBalances[_investor].add(amount);

        emit Invested(_investor, amount);
    }

    /// @notice owners: send `value` of ether to address `to`, can be called if crowdsale succeeded
    /// @param to where to send ether
    /// @param value amount of wei to send
    function sendEther(address to, uint256 value)
        external
        validAddress(to)
        onlymanyowners(keccak256(msg.data))
        requiresState(State.SUCCEEDED)
    {
        require(value > 0 && address(this).balance >= value);
        to.transfer(value);
        emit EtherSent(to, value);
    }

    /// @notice withdraw accumulated balance, called by payee in case crowdsale failed
    function withdrawPayments(address payee)
        external
        nonReentrant
        onlyController
        requiresState(State.REFUNDING)
    {
        uint256 payment = m_weiBalances[payee];

        require(payment != 0);
        require(address(this).balance >= payment);

        totalInvested = totalInvested.sub(payment);
        m_weiBalances[payee] = 0;

        payee.transfer(payment);
        emit RefundSent(payee, payment);
    }

    function getInvestorsCount() external view returns (uint256) { return m_investors.length; }


    // FIELDS

    /// @notice total amount of investments in wei
    uint256 public totalInvested;

    /// @notice state of the registry
    State public m_state = State.GATHERING;

    /// @dev balances of investors in wei
    mapping(address => uint256) public m_weiBalances;

    /// @dev list of unique investors
    address[] public m_investors;
}
