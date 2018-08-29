pragma solidity ^0.4.24;

import '../../crowdsale/SimpleCrowdsaleBase.sol';
import '../../crowdsale/ExternalAccountWalletConnector.sol';
import '../../crowdsale/InvestmentAnalytics.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';


/// @title SimpleCrowdsaleTestHelper pre-sale contract. DON'T use it in production!
contract SimpleCrowdsaleTestHelper is SimpleCrowdsaleBase, Ownable, ExternalAccountWalletConnector, InvestmentAnalytics {
    using SafeMath for uint256;

    constructor (address token, address funds)
        public
        SimpleCrowdsaleBase(token)
        ExternalAccountWalletConnector(funds)
    {
    }

    function calculateTokens(address /*investor*/, uint256 payment, uint256 /*extraBonuses*/) internal view returns (uint256) {
        return payment;
    }

    /// @notice minimum amount of funding to consider preSale as successful
    function getMinimumFunds() internal view returns (uint256) {
        return 0;
    }

    /// @notice maximum investments to be accepted during preSale
    function getMaximumFunds() internal view returns (uint256) {
        return 400 finney;
    }

    /// @notice start time of the pre-ICO
    function getStartTime() internal view returns (uint256) {
        return 1507766400;
    }

    /// @notice end time of the pre-ICO
    function getEndTime() internal view returns (uint256) {
        return getStartTime() + (1 days);
    }

    function createMorePaymentChannels(uint256 limit) external onlyOwner returns (uint256) {
        return createMorePaymentChannelsInternal(limit);
    }

    function getCurrentTime() internal view returns (uint256) {
        return m_time;
    }

    function setTime(uint256 time) external onlyOwner {
        m_time = time;
    }

    uint256 m_time;
}

