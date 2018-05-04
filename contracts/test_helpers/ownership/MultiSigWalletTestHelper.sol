pragma solidity ^0.4.15;

import '../../ownership/MultiSigWallet.sol';


/// @title DONT use it in production! Its a test helper which could set arbitrary time.
contract MultiSigWalletTestHelper is MultiSigWallet {

    function MultiSigWalletTestHelper(address[] _owners, uint _signaturesRequired, uint thawTs)
        public
        MultiSigWallet(_owners, _signaturesRequired, thawTs)
    {
    }

    function getCurrentTime() internal view returns (uint) {
        return m_time;
    }

    function setTime(uint time) external {
        m_time = time;
    }

    uint m_time;
}
