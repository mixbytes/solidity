pragma solidity ^0.4.15;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import '../../crowdsale/FundsRegistryWalletConnector.sol';
import '../../crowdsale/SimpleCrowdsaleBase.sol';
import '../../crowdsale/FundsRegistry.sol';
import '../../crowdsale/InvestmentAnalytics.sol';
import '../../ownership/multiowned.sol';
import '../../test_helpers/token/MintableMultiownedCirculatingTokenTestHelper.sol';


/// @title CrowdsaleWithFundsTestHelper  USE ONLY FOR TEST PURPOSES
contract CrowdsaleWithFundsTestHelper is SimpleCrowdsaleBase, multiowned, FundsRegistryWalletConnector, InvestmentAnalytics {
    using SafeMath for uint256;

    event Withdraw(address payee);

    function CrowdsaleWithFundsTestHelper(address[] _owners, address _token)
        public
        multiowned(_owners, 2)
        SimpleCrowdsaleBase(_token)
        FundsRegistryWalletConnector(_owners, 2)
    {
        require(3 == _owners.length);
    }


    function getFundsAddress() public constant returns (address) {
        return m_fundsAddress;
    }

    function withdrawPayments() public {

        if (getCurrentTime() >= getEndTime())
            finish();

        require(m_fundsAddress.m_state() == FundsRegistry.State.REFUNDING);

        Withdraw(msg.sender);

        m_fundsAddress.withdrawPayments(msg.sender);
    }


    function calculateTokens(address /*investor*/, uint payment, uint /*extraBonuses*/) internal constant returns (uint) {
        return payment;
    }

    /// @notice minimum amount of funding to consider preSale as successful
    function getMinimumFunds() internal constant returns (uint) {
        return 200 finney;
    }

    /// @notice maximum investments to be accepted during preSale
    function getMaximumFunds() internal constant returns (uint) {
        return 1000 finney;
    }

    /// @notice start time of the sale
    function getStartTime() internal constant returns (uint) {
        return 1507766400;
    }

    /// @notice public ifce for tests
    function _getStartTime() external constant returns (uint) {
        return getStartTime();
    }

    /// @notice public ifce for tests
    function _getEndTime() external constant returns (uint) {
        return getEndTime();
    }

    /// @notice end time of the sale
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
        super.wcOnCrowdsaleSuccess();
        getToken().startCirculation();
    }

    function getToken() public constant returns (MintableMultiownedCirculatingTokenTestHelper) {
        return MintableMultiownedCirculatingTokenTestHelper(address(m_token));
    }

    function iaOnInvested(address investor, uint payment, bool /*usingPaymentChannel*/) internal
    {
        buyInternal(investor, payment, 0);
    }

    uint m_time;
}

