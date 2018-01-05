// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;

import './multiowned.sol';


/**
 * @title Basic demonstration of multi-owned entity.
 */
contract SimpleMultiSigWallet is multiowned {

    event Deposit(address indexed sender, uint value);
    event EtherSent(address indexed to, uint value);

    function SimpleMultiSigWallet(address[] _owners, uint _signaturesRequired)
        public
        multiowned(_owners, _signaturesRequired)
    {
    }

    /// @dev Fallback function allows to deposit ether.
    function()
        external
        payable
    {
        if (msg.value > 0)
            Deposit(msg.sender, msg.value);
    }

    /// @notice Send `value` of ether to address `to`
    /// @param to where to send ether
    /// @param value amount of wei to send
    function sendEther(address to, uint value)
        external
        onlymanyowners(keccak256(msg.data))
    {
        require(0 != to);
        require(value > 0 && this.balance >= value);
        to.transfer(value);
        EtherSent(to, value);
    }
}
