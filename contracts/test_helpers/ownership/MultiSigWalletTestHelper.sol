pragma solidity ^0.4.24;

import '../../ownership/MultiSigWallet.sol';


/// @title DONT use it in production! Its a test helper which could set arbitrary time.
contract MultiSigWalletTestHelper is MultiSigWallet {

    constructor (address[] _owners, uint256 _signaturesRequired, uint256 thawTs)
        public
        MultiSigWallet(_owners, _signaturesRequired, thawTs)
    {
    }

    function getCurrentTime() internal view returns (uint256) {
        return m_time;
    }

    function setTime(uint256 time) external {
        m_time = time;
    }

    uint256 m_time;
}
