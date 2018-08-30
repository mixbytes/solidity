// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import './multiowned.sol';


/**
 * @title Contract which is owned by owners and operated by controller.
 *
 * @notice Provides a way to set up an entity (typically other contract) entitled to control actions of this contract.
 * Controller is set up by owners or during construction.
 *
 * @dev controller check is performed by onlyController modifier.
 */
contract MultiownedControlled is multiowned {

    event ControllerSet(address controller);
    event ControllerRetired(address was);
    event ControllerRetiredForever(address was);


    modifier onlyController {
        require(msg.sender == m_controller);
        _;
    }


    // PUBLIC interface

    constructor (address[] _owners, uint256 _signaturesRequired, address _controller)
        public
        multiowned(_owners, _signaturesRequired)
    {
        m_controller = _controller;
        emit ControllerSet(m_controller);
    }

    /// @dev sets the controller
    function setController(address _controller) external onlymanyowners(keccak256(msg.data)) {
        require(m_attaching_enabled);
        m_controller = _controller;
        emit ControllerSet(m_controller);
    }

    /// @dev ability for controller to step down
    function detachController() external onlyController {
        address was = m_controller;
        m_controller = address(0);
        emit ControllerRetired(was);
    }

    /// @dev ability for controller to step down and make this contract completely automatic (without third-party control)
    function detachControllerForever() external onlyController {
        assert(m_attaching_enabled);
        address was = m_controller;
        m_controller = address(0);
        m_attaching_enabled = false;
        emit ControllerRetiredForever(was);
    }


    // FIELDS

    /// @notice address of entity entitled to mint new tokens
    address public m_controller;

    bool public m_attaching_enabled = true;
}
