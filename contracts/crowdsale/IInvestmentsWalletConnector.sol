// Copyright (C) 2017  MixBytes, LLC

// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND (express or implied).

pragma solidity ^0.4.24;

/**
 * @title Interface for code which processes and stores investments.
 * @author Eenae
 */
contract IInvestmentsWalletConnector {
    /// @dev process and forward investment
    function storeInvestment(address investor, uint256 payment) internal;

    /// @dev total investments amount stored using storeInvestment()
    function getTotalInvestmentsStored() internal view returns (uint256);

    /// @dev called in case crowdsale succeeded
    function wcOnCrowdsaleSuccess() internal;

    /// @dev called in case crowdsale failed
    function wcOnCrowdsaleFailure() internal;
}
