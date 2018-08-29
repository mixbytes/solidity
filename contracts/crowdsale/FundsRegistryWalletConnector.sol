// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

import './IInvestmentsWalletConnector.sol';
import './FundsRegistry.sol';


/**
 * @title Stores investments in FundsRegistry.
 * @author Eenae
 */
contract FundsRegistryWalletConnector is IInvestmentsWalletConnector {

    constructor(address[] fundOwners, uint256 ownersSignatures) public {
        m_fundsAddress = new FundsRegistry(fundOwners, ownersSignatures, this);
    }

    /// @dev process and forward investment
    function storeInvestment(address investor, uint256 payment) internal {
        m_fundsAddress.invested.value(payment)(investor);
    }

    /// @dev total investments amount stored using storeInvestment()
    function getTotalInvestmentsStored() internal view returns (uint256) {
        return m_fundsAddress.totalInvested();
    }

    /// @dev called in case crowdsale succeeded
    function wcOnCrowdsaleSuccess() internal {
        m_fundsAddress.changeState(FundsRegistry.State.SUCCEEDED);
        m_fundsAddress.detachController();
    }

    /// @dev called in case crowdsale failed
    function wcOnCrowdsaleFailure() internal {
        m_fundsAddress.changeState(FundsRegistry.State.REFUNDING);
    }

    /// @notice address of wallet which stores funds
    FundsRegistry public m_fundsAddress;
}
