// Copyright (C) 2017-2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import './multiowned.sol';

/**
 * @title Basic demonstration of multi-owned entity.
 */
contract SimpleMultiSigWallet is multiowned {

    event Deposit(address indexed sender, uint256 value);
    event EtherSent(address indexed to, uint256 value);

    constructor (address[] _owners, uint256 _signaturesRequired)
        public
        multiowned(_owners, _signaturesRequired)
    {
    }

    /// @dev Fallback function allows to deposit ether.
    function()
        public
        payable
    {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

    /// @notice Send `value` of ether to address `to`
    /// @param to where to send ether
    /// @param value amount of wei to send
    function sendEther(address to, uint256 value)
        public
        onlymanyowners(keccak256(msg.data))
    {
        require(address(0) != to);
        require(value > 0 && address(this).balance >= value);
        to.transfer(value);
        emit EtherSent(to, value);
    }
}
