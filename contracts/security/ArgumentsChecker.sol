// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;


/// @title utility methods and modifiers of arguments validation
contract ArgumentsChecker {

    /// @dev check which prevents short address attack
    modifier payloadSizeIs(uint size) {
       require(msg.data.length == size + 4 /* function selector */);
       _;
    }

    /// @dev check that address is valid
    modifier validAddress(address addr) {
        require(addr != address(0));
        _;
    }
}
