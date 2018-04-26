// Copyright (C) 2017-2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;

import './multiowned.sol';
import 'zeppelin-solidity/contracts/token/ERC20Basic.sol';


/**
 * @title Basic demonstration of multi-owned entity.
 */
contract SimpleMultiSigWallet is multiowned {

    event Deposit(address indexed sender, uint value);
    event EtherSent(address indexed to, uint value);
    event TokensSent(address token, address indexed to, uint value);

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
        require(address(0) != to);
        require(value > 0 && this.balance >= value);
        to.transfer(value);
        EtherSent(to, value);
    }

    function sendTokens(address token, address to, uint value)
        external
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

    function tokenBalance(address token) external view returns (uint256) {
        return ERC20Basic(token).balanceOf(this);
    }

    function isContract(address _addr)
        private
        view
        returns (bool hasCode)
    {
        uint length;
        assembly { length := extcodesize(_addr) }
        return length > 0;
    }
}
