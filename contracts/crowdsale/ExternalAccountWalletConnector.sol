// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import './IInvestmentsWalletConnector.sol';
import '../security/ArgumentsChecker.sol';


/**
 * @title Stores investments in specified external account.
 * @author Eenae
 */
contract ExternalAccountWalletConnector is ArgumentsChecker, IInvestmentsWalletConnector {

    constructor (address accountAddress)
        public
        validAddress(accountAddress)
    {
        m_walletAddress = accountAddress;
    }

    /// @dev process and forward investment
    function storeInvestment(address /*investor*/, uint256 payment) internal
    {
        m_wcStored += payment;
        m_walletAddress.transfer(payment);
    }

    /// @dev total investments amount stored using storeInvestment()
    function getTotalInvestmentsStored() internal view returns (uint256)
    {
        return m_wcStored;
    }

    /// @dev called in case crowdsale succeeded
    function wcOnCrowdsaleSuccess() internal {
    }

    /// @dev called in case crowdsale failed
    function wcOnCrowdsaleFailure() internal {
    }

    /// @notice address of wallet which stores funds
    address public m_walletAddress;

    /// @notice total investments stored to wallet
    uint256 public m_wcStored;
}
