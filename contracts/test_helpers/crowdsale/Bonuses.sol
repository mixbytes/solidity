pragma solidity ^0.4.24;

import '../../crowdsale/FixedTimeBonuses.sol';

contract Bonuses {
    using FixedTimeBonuses for FixedTimeBonuses.Data;
    FixedTimeBonuses.Data m_bonuses;

    function add(uint256 endTime, uint256 bonus) public {
        m_bonuses.bonuses.push(FixedTimeBonuses.Bonus(endTime, bonus));
    }

    function validate(bool shouldDecrease) public view {
        m_bonuses.validate(shouldDecrease);
    }

    function getLastTime() public view returns (uint256) {
        return m_bonuses.getLastTime();
    }

    function getBonus(uint256 time) public view returns (uint256) {
        return m_bonuses.getBonus(time);
    }
}

