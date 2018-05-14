'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5

import {crowdsaleUTest} from '../utest/Crowdsale';

const SimpleCrowdsaleTestHelper = artifacts.require("./test_helpers/crowdsale/SimpleCrowdsaleTestHelper.sol");
const MintableMultiownedToken = artifacts.require("./token/MintableMultiownedToken.sol");


contract('SimpleCrowdsaleTestHelper', function(accounts) {
    async function instantiate(role) {
        const token = await MintableMultiownedToken.new(
            [role.owner1, role.owner2, role.owner3], 2, role.nobody, {from: role.nobody}
        );
        const crowdsale = await SimpleCrowdsaleTestHelper.new(
            token.address, role.owner3, {from: role.nobody}
        );

        await crowdsale.transferOwnership(role.owner1, {from: role.nobody});

        await token.setController(crowdsale.address, {from: role.owner1});
        await token.setController(crowdsale.address, {from: role.owner2});

        return [crowdsale, token, role.owner3];
    }

    for (const [name, fn] of crowdsaleUTest(accounts, instantiate, {
        extraPaymentFunction: 'buy',
        rate: 1,
        hardCap: web3.toWei(400, 'finney'),
        startTime: (new Date('Thu, 12 Oct 2017 0:00:00 GMT')).getTime() / 1000,
        endTime: (new Date('Fri, 13 Oct 2017 0:00:00 GMT')).getTime() / 1000,
        maxTimeBonus: 0,
        firstPostICOTxFinishesSale: true,
        postICOTxThrows: false,
        hasAnalytics: false,
        analyticsPaymentBonus: 0,
        // No circulation
        tokenTransfersDuringSale: true
    }))
        it(name, fn);
});
