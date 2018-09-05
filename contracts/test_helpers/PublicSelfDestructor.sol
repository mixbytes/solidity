// Copyright (C) 2018  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

/// @title Test helper to test unavoidable ether transfer
contract PublicSelfDestructor {
	function SendEtherAndDie(address inFavorOfContract) public payable {
		selfdestruct(inFavorOfContract);
	}
}
