pragma solidity 0.4.15;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import '../../crowdsale/FundsRegistryWalletConnector.sol';
import '../../crowdsale/SimpleCrowdsaleBase.sol';
import '../../crowdsale/InvestmentAnalytics.sol';
import '../../ownership/multiowned.sol';


/// @title CrowdsaleWithFundsTestHelper  USE ONLY FOR TEST PURPOSES
contract CrowdsaleWithFundsTestHelper is SimpleCrowdsaleBase, multiowned, FundsRegistryWalletConnector, InvestmentAnalytics {
    using SafeMath for uint256;

    function CrowdsaleWithFundsTestHelper(address[] _owners, address _token)
    multiowned(_owners, 2)
    SimpleCrowdsaleBase(_token)
    FundsRegistryWalletConnector(_owners, 2)
    {
        require(3 == _owners.length);
    }

    function getFundsAddress() public constant returns (address) {
        return m_fundsAddress;
    }

    function withdrawPayments() public payable {
        m_fundsAddress.withdrawPayments(msg.sender);
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

    function createMorePaymentChannels(uint limit) external onlyowner returns (uint) {
        return createMorePaymentChannelsInternal(limit);
    }

    function getCurrentTime() internal constant returns (uint) {
        return m_time;
    }

    function setTime(uint time) external onlyowner {
        m_time = time;
    }

    uint m_time;
}

