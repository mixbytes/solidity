'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5

import {crowdsaleUTest} from '../utest/Crowdsale';
import expectThrow from '../helpers/expectThrow';

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


// Additional tests
contract('CrowdsaleWithFundsAdditionalTests', function(accounts) {
    const roles = {
        cash: accounts[0],
        owner3: accounts[0],
        owner1: accounts[1],
        owner2: accounts[2],
        investor1: accounts[2],
        investor2: accounts[3],
        investor3: accounts[4],
        nobody: accounts[5]
    };

    describe('Withdraw', function() {
        /**
         * Start sale. investors buy tokens.
         * Then finish sale and don't reach soft cap.
         * Investors start to withdraw their money back.
         */

        it("Withdraw integration test", async function(){
            const token = await MintableMultiownedCirculatingTokenTestHelper.new(
                [roles.owner1, roles.owner2, roles.owner3], 2, roles.nobody, {from: roles.nobody}
            );
            const crowdsale = await CrowdsaleWithFundsTestHelper.new(
                [roles.owner1, roles.owner2, roles.owner3], token.address, {from: roles.nobody}
            );

            await token.setController(crowdsale.address, {from: roles.owner1});
            await token.setController(crowdsale.address, {from: roles.owner2});

            const funds = await FundsRegistry.at(await crowdsale.getFundsAddress());

            let startTs = await crowdsale._getStartTime();

            await crowdsale.setTime(startTs.plus(1), {from: roles.owner1});

            crowdsale.buy({
                    from: roles.investor1,
                    value: web3.toWei(20, 'finney')
            })
            crowdsale.buy({
                    from: roles.investor2,
                    value: web3.toWei(30, 'finney')
            });

            let numInvestors = await funds.getInvestorsCount();
            assert(numInvestors.eq(2));

            let balance = await funds.totalInvested({from: roles.nobody});
            assert(balance.eq(web3.toWei(50, 'finney')));

            let endTs = await crowdsale._getEndTime();
            await crowdsale.setTime(endTs.plus(1), {from: roles.owner1});

            await crowdsale.withdrawPayments({from: roles.investor1});
            await crowdsale.withdrawPayments({from: roles.investor2});

            await expectThrow(crowdsale.withdrawPayments({from: roles.investor3}));

            balance = await funds.totalInvested({from: roles.nobody});
            assert(balance.eq(0));
        });
    });
});
