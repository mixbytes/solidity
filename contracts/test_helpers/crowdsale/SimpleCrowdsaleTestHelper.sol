pragma solidity 0.4.15;

import '../../crowdsale/SimpleCrowdsaleBase.sol';
import '../../crowdsale/ExternalAccountWalletConnector.sol';
import '../../crowdsale/InvestmentAnalytics.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';


/// @title ICOPlate pre-sale contract. DONT use it in production!
contract SimpleCrowdsaleTestHelper is SimpleCrowdsaleBase, Ownable, ExternalAccountWalletConnector, InvestmentAnalytics {
    using SafeMath for uint256;

    function SimpleCrowdsaleTestHelper(address token, address funds)
    SimpleCrowdsaleBase(token)
    ExternalAccountWalletConnector(funds)
    {
    }

    function calculateTokens(address /*investor*/, uint payment, uint /*extraBonuses*/) internal constant returns (uint) {
        return payment;
    }

    /// @notice minimum amount of funding to consider preSale as successful
    function getMinimumFunds() internal constant returns (uint) {
        return 0;
    }

    /// @notice maximum investments to be accepted during preSale
    function getMaximumFunds() internal constant returns (uint) {
        return 400 finney;
    }

    /// @notice start time of the pre-ICO
    function getStartTime() internal constant returns (uint) {
        return 1507766400;
    }

    /// @notice end time of the pre-ICO
    function getEndTime() internal constant returns (uint) {
        return getStartTime() + (1 days);
    }

    function createMorePaymentChannels(uint limit) external onlyOwner returns (uint) {
        return createMorePaymentChannelsInternal(limit);
    }

    function getCurrentTime() internal constant returns (uint) {
        return m_time;
    }

    function setTime(uint time) external onlyOwner {
        m_time = time;
    }

    uint m_time;
}

