// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.15;

import '../ownership/MultiownedControlled.sol';
import './MintableToken.sol';
import 'zeppelin-solidity/contracts/token/StandardToken.sol';


/// @title StandardToken which can be minted by another contract.
contract MintableMultiownedToken is MintableToken, MultiownedControlled, StandardToken {

    // PUBLIC interface

    function MintableMultiownedToken(address[] _owners, uint _signaturesRequired, address _minter)
        public
        MultiownedControlled(_owners, _signaturesRequired, _minter)
    {
    }


    /// @dev mints new tokens
    function mint(address _to, uint256 _amount) public onlyController {
        require(m_externalMintingEnabled);
        mintInternal(_to, _amount);
    }

    /// @dev disables mint(), irreversible!
    function disableMinting() public onlyController {
        require(m_externalMintingEnabled);
        m_externalMintingEnabled = false;
    }


    // INTERNAL functions

    function mintInternal(address _to, uint256 _amount) internal {
        totalSupply = totalSupply.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        Transfer(address(0), _to, _amount);
        Mint(_to, _amount);
    }


    // FIELDS

    /// @notice if this true then token is still externally mintable
    bool public m_externalMintingEnabled = true;
}
