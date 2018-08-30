// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import '../../crowdsale/FundsRegistry.sol';


/// @title DONT use it in production! Its a test helper which can burn money.
contract FundsRegistryTestHelper is FundsRegistry {

    constructor (address[] _owners, uint256 _signaturesRequired, address _controller)
        public
        FundsRegistry(_owners, _signaturesRequired, _controller)
    {
    }

    function burnSomeEther() external onlyowner {
        address(0).transfer(10 finney);
    }
}
