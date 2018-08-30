pragma solidity ^0.4.24;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
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

    constructor(address[] _owners, address _token)
        public
        multiowned(_owners, 2)
        SimpleCrowdsaleBase(_token)
        FundsRegistryWalletConnector(_owners, 2)
    {
        require(3 == _owners.length);
    }


    function getFundsAddress() public view returns (address) {
        return m_fundsAddress;
    }

    function withdrawPayments() public {

        if (getCurrentTime() >= getEndTime())
            finish();

        require(m_fundsAddress.m_state() == FundsRegistry.State.REFUNDING);

        emit Withdraw(msg.sender);

        m_fundsAddress.withdrawPayments(msg.sender);
    }


    function calculateTokens(address /*investor*/, uint256 payment, uint256 /*extraBonuses*/) internal view returns (uint256) {
        return payment;
    }

    /// @notice minimum amount of funding to consider preSale as successful
    function getMinimumFunds() internal view returns (uint256) {
        return 200 finney;
    }

    /// @notice maximum investments to be accepted during preSale
    function getMaximumFunds() internal view returns (uint256) {
        return 1000 finney;
    }

    /// @notice start time of the sale
    function getStartTime() internal view returns (uint256) {
        return 1507766400;
    }

    /// @notice public ifce for tests
    function _getStartTime() external view returns (uint256) {
        return getStartTime();
    }

    /// @notice public ifce for tests
    function _getEndTime() external view returns (uint256) {
        return getEndTime();
    }

    /// @notice end time of the sale
    function getEndTime() internal view returns (uint256) {
        return 1507852800;
        //return getStartTime() + (1 days);
    }

    function createMorePaymentChannels(uint256 limit) external onlyowner returns (uint256) {
        return createMorePaymentChannelsInternal(limit);
    }

    function getCurrentTime() internal view returns (uint256) {
        return m_time;
    }

    function setTime(uint256 time) external onlyowner {
        m_time = time;
    }

    function wcOnCrowdsaleSuccess() internal {
        super.wcOnCrowdsaleSuccess();
        getToken().startCirculation();
    }

    function getToken() public view returns (MintableMultiownedCirculatingTokenTestHelper) {
        return MintableMultiownedCirculatingTokenTestHelper(address(m_token));
    }

    function iaOnInvested(address investor, uint256 payment, bool /*usingPaymentChannel*/) internal
    {
        buyInternal(investor, payment, 0);
    }

    uint256 m_time;
}

