// Copyright (C) 2017-2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import './multiowned.sol';
import './SimpleMultiSigWallet.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol';


/**
 * @title Multisignature wallet with ERC20 tokens support.
 */
contract MultiSigWallet is SimpleMultiSigWallet {

    // EVENTS

    event TokensSent(address token, address indexed to, uint256 value);


    // MODIFIERS

    modifier notFrozen {
        require(getCurrentTime() >= m_thawTs);
        _;
    }


    // PUBLIC FUNCTIONS

    constructor (address[] _owners, uint256 _signaturesRequired, uint256 _thawTs)
        public
        SimpleMultiSigWallet(_owners, _signaturesRequired)
    {
        m_thawTs = _thawTs;
    }

    function sendEther(address to, uint256 value)
        public
        notFrozen
    {
        super.sendEther(to, value);
    }

    function sendTokens(address token, address to, uint256 value)
        public
        notFrozen
        onlymanyowners(keccak256(msg.data))
        returns (bool)
    {
        require(address(0) != to);
        require(address(0) != token);
        require(token != to);
        require(isContract(token));

        if (ERC20Basic(token).transfer(to, value)) {
            emit TokensSent(token, to, value);
            return true;
        }

        return false;
    }


    // PUBLIC VIEW FUNCTIONS

    function tokenBalance(address token) public view returns (uint256) {
        return ERC20Basic(token).balanceOf(this);
    }

    function frozenUntil() public view returns (uint256) {
        return m_thawTs;
    }


    // INTERNAL FUNCTIONS

    function isContract(address _addr)
        private
        view
        returns (bool hasCode)
    {
        uint256 length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function getCurrentTime() internal view returns (uint256) {
        return now;
    }


    // FIELDS

    uint256 private m_thawTs;
}
