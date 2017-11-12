'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5

import {crowdsaleUTest} from '../utest/Crowdsale';

const CrowdsaleWithFundsTestHelper = artifacts.require("./test_helpers/crowdsale/CrowdsaleWithFundsTestHelper.sol");
const MintableMultiownedCirculatingTokenTestHelper = artifacts.require("./test_helpers/token/MintableMultiownedCirculatingTokenTestHelper.sol");
const FundsRegistry = artifacts.require("./crowdsale/FundsRegistry.sol");


contract('CrowdsaleWithFunds', function(accounts) {
    async function instantiate(role) {
        const token = await MintableMultiownedCirculatingTokenTestHelper.new(
            [role.owner1, role.owner2, role.owner3], 2, role.nobody, {from: role.nobody}
        );
        const crowdsale = await CrowdsaleWithFundsTestHelper.new(
            [role.owner1, role.owner2, role.owner3], token.address, {from: role.nobody}
        );

        //await crowdsale.transferOwnership(role.owner1, {from: role.nobody});
        await token.setController(crowdsale.address, {from: role.owner1});
        await token.setController(crowdsale.address, {from: role.owner2});

        const funds = await FundsRegistry.at(await crowdsale.getFundsAddress());

        return [crowdsale, token, funds];
    }

    for (const [name, fn] of crowdsaleUTest(accounts, instantiate, {
        usingFund: true,
        extraPaymentFunction: 'buy',
        rate: 1,
        softCap: web3.toWei(100, 'finney'),
        hardCap: web3.toWei(400, 'finney'),
        startTime: (new Date('Thu, 12 Oct 2017 0:00:00 GMT')).getTime() / 1000,
        endTime: (new Date('Fri, 13 Oct 2017 0:00:00 GMT')).getTime() / 1000,
        maxTimeBonus: 0,
        firstPostICOTxFinishesSale: true,
        postICOTxThrows: false,
        hasAnalytics: false,
        analyticsPaymentBonus: 0,
        // No circulation
        tokenTransfersDuringSale: false
    }))
        it(name, fn);
});
