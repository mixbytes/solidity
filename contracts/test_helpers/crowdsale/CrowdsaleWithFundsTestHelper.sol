pragma solidity 0.4.15;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import '../../crowdsale/FundsRegistryWalletConnector.sol';
import '../../crowdsale/SimpleCrowdsaleBase.sol';
import '../../crowdsale/InvestmentAnalytics.sol';
import '../../ownership/multiowned.sol';
import '../../test_helpers/token/MintableMultiownedCirculatingTokenTestHelper.sol';


/// @title CrowdsaleWithFundsTestHelper  USE ONLY FOR TEST PURPOSES
contract CrowdsaleWithFundsTestHelper is SimpleCrowdsaleBase, multiowned, FundsRegistryWalletConnector, InvestmentAnalytics {
    using SafeMath for uint256;

    function CrowdsaleWithFundsTestHelper(address[] _owners, address _token)
        multiowned(_owners, 2)
        SimpleCrowdsaleBase(_token)
        FundsRegistryWalletConnector(_owners, 2)
    {
        require(3 == _owners.length);
        m_token = MintableMultiownedCirculatingTokenTestHelper(_token);
    }


    function getFundsAddress() public constant returns (address) {
        return m_fundsAddress;
    }

    function withdrawPayments() public {
        m_fundsAddress.withdrawPayments(msg.sender);
    }


    function calculateTokens(address /*investor*/, uint payment, uint /*extraBonuses*/) internal constant returns (uint) {
        return payment;
    }

    /// @notice minimum amount of funding to consider preSale as successful
    function getMinimumFunds() internal constant returns (uint) {
        return 100 finney;
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
        return 1507852800;
        //return getStartTime() + (1 days);
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

    function wcOnCrowdsaleSuccess() internal {
        m_fundsAddress.changeState(FundsRegistry.State.SUCCEEDED);
        m_token.startCirculation();
    }

    /// @dev called in case crowdsale failed
    function wcOnCrowdsaleFailure() internal {
        m_fundsAddress.changeState(FundsRegistry.State.REFUNDING);
    }

    uint m_time;
    MintableMultiownedCirculatingTokenTestHelper public m_token;
}

