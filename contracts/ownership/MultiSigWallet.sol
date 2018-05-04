// Copyright (C) 2017-2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;

import './multiowned.sol';
import './SimpleMultiSigWallet.sol';
import 'zeppelin-solidity/contracts/token/ERC20Basic.sol';


/**
 * @title Multisignature wallet with ERC20 tokens support.
 */
contract MultiSigWallet is SimpleMultiSigWallet {

    // EVENTS

    event TokensSent(address token, address indexed to, uint value);


    // MODIFIERS

    modifier notFrozen {
        require(getCurrentTime() >= m_thawTs);
        _;
    }


    // PUBLIC FUNCTIONS

    function MultiSigWallet(address[] _owners, uint _signaturesRequired, uint thawTs)
        public
        SimpleMultiSigWallet(_owners, _signaturesRequired)
    {
        m_thawTs = thawTs;
    }

    function sendEther(address to, uint value)
        public
        notFrozen
    {
        super.sendEther(to, value);
    }

    function sendTokens(address token, address to, uint value)
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
            TokensSent(token, to, value);
            return true;
        }

        return false;
    }


    // PUBLIC VIEW FUNCTIONS

    function tokenBalance(address token) public view returns (uint256) {
        return ERC20Basic(token).balanceOf(this);
    }

    function frozenUntil() public view returns (uint) {
        return m_thawTs;
    }


    // INTERNAL FUNCTIONS

    function isContract(address _addr)
        private
        view
        returns (bool hasCode)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }

    function getCurrentTime() internal view returns (uint) {
        return now;
    }


    // FIELDS

    uint private m_thawTs;
}
