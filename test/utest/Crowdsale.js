/*
 *  Universal test: crowdsale.
 */

'use strict';

import {expectThrow} from 'openzeppelin-solidity/test/helpers/expectThrow';
import {l} from '../helpers/debug';
import '../helpers/typeExt';


function getRoles(accounts) {
    return {
        owner3: accounts[0],
        owner1: accounts[1],
        owner2: accounts[2],
        investor1: accounts[2],
        investor2: accounts[3],
        investor3: accounts[4],
        nobody: accounts[5]
    };
}


export function crowdsaleUTest(accounts, instantiate, settings) {
    const role = getRoles(accounts);

    // default settings

    const defaultSettings = {
        // if true gathered ether goes to contract FundsRegistry, otherwise to pre-existed account
        usingFund: false,
        // Crowdsale method to be called when want to withdraw payments from funds
        usingFundCrowdsalewithdrawPaymentsMethod: 'withdrawPayments',

        // funds collected during previous sales and taken into consideration when computing caps
        preCollectedFunds: 0,

        softCap: undefined,
        hardCap: undefined,

        // extraPaymentFunction: '',
        // rate: ,
        startTime: undefined,
        endTime: undefined,
        maxTimeBonus: 0,

        tokenTransfersDuringSale: false,

        firstPostICOTxFinishesSale: true,
        postICOTxThrows: true,

        hasAnalytics: false,
        analyticsPaymentBonus: 0
    };

    for (let k in defaultSettings)
        if (!(k in settings))
            settings[k] = defaultSettings[k];


    // utility consts

    const usingFund = settings.usingFund;
    const AnalyticProxy = settings.hasAnalytics ? artifacts.require("AnalyticProxy") : undefined;


    // utility functions

    function assertBigNumberEqual(actual, expected, message=undefined) {
        assert(actual.eq(expected), "{2}expected {0}, but got: {1}".format(expected, actual,
            message ? message + ': ' : ''));
    }

    // gets balance of account/contract which store funds
    async function getFundsBalance(funds) {
        return await web3.eth.getBalance(usingFund ? funds.address : funds);
    }

    async function assertBalances(sale, token, cash, cashInitial, cashAdded) {
        assert.equal(await web3.eth.getBalance(sale.address), 0, "expecting balance of the sale to be empty");
        assert.equal(await web3.eth.getBalance(token.address), 0, "expecting balance of the token to be empty");
        const actualCashAdded = (await getFundsBalance(cash)).sub(cashInitial);
        assert(actualCashAdded.eq(cashAdded), "expecting invested cash to be {0}, but got: {1}".format(cashAdded, actualCashAdded));
    }

    async function assertTokenBalances(token, expectedBalances) {
        for (const acc in expectedBalances) {
            const balance = await token.balanceOf(acc);
            assert(balance.eq(expectedBalances[acc]),
                "expecting token balance of {0} to be {1}, but got: {2}".format(acc, expectedBalances[acc], balance));
        }
    }

    // exec tx on multiowned contract
    // @param args tx arguments
    // @return promise
    async function runMultiSigTx(contract, fn, args) {
        const owners = await contract.getOwners();
        let i = await contract.m_multiOwnedRequired() - 1;

        for (; i; i--)
            // first signatures
            await fn(... args.concat({from: owners[i]}));

        // the last signature
        return fn(... args.concat({from: owners[i]}));
    }


    function calcTokens(wei, rate, bonuses) {
        const base = new web3.BigNumber(wei).mul(rate);
        const bonusesSum = bonuses.reduce((accumulator, currentValue) => accumulator + currentValue);
        return base.mul(100 + bonusesSum).div(100);
    }


    // asserting that collected ether cant be transferred to owners
    async function checkNotSendingEther(funds) {
        await expectThrow(funds.sendEther(role.nobody, web3.toWei(20, 'finney'), {from: role.nobody}));
        await expectThrow(funds.sendEther(role.investor3, web3.toWei(20, 'finney'), {from: role.investor3}));

        await expectThrow(runMultiSigTx(funds, funds.sendEther, [role.owner1, web3.toWei(20, 'finney')]));
    }

    // asserting that collected ether cant be withdrawn by investors
    async function checkNotWithdrawing(crowdsale) {
        for (const from_ of [role.nobody, role.owner1, role.investor1, role.investor2, role.investor3]) {
            await expectThrow(
                crowdsale[settings.usingFundCrowdsalewithdrawPaymentsMethod]({from: from_})
            );
        }
    }

    // asserting that investments cant be made
    async function checkNotInvesting(crowdsale, token, funds) {
        const cashInitial = await getFundsBalance(funds);
        for (const from_ of [role.nobody, role.owner1, role.investor1, role.investor2, role.investor3]) {
            const startingBalance = await token.balanceOf(from_);
            const tx = crowdsale.sendTransaction({from: from_, value: web3.toWei(20, 'finney')});
            if (settings.postICOTxThrows)
                await expectThrow(tx);
            else
                await tx;
            assertBigNumberEqual(await token.balanceOf(from_), startingBalance);
        }
        await assertBalances(crowdsale, token, funds, cashInitial, 0);
    }

    // asserting that token is not circulating yet
    async function checkNoTransfers(token) {
        await expectThrow(token.transfer(role.nobody, 1000, {from: role.nobody}));
        await expectThrow(token.transfer(role.investor3, 1000, {from: role.nobody}));
        // TODO transfer (await token.balanceOf(role.investor1)).div(10).add(1000) tokens
        await expectThrow(token.transfer(role.nobody, 1000, {from: role.investor1}));
        await expectThrow(token.transfer(role.investor3, 1000, {from: role.investor2}));
    }


    // testing-related functions

    async function ourInstantiate() {
        const [sale, token, funds] = await instantiate(role);
        // funds is either external account or FundsRegistry

        if (settings.hasAnalytics) {
            await sale.createMorePaymentChannels(5, {from: role.owner1});
            sale.testPaymentChannels = await sale.readPaymentChannels();
            sale.testNextPaymentChannel = 0;
        }

        return [sale, token, funds];
    }

    async function runFirstPostSaleTx(txPromise) {
        if (settings.firstPostICOTxFinishesSale || !settings.postICOTxThrows)
            // expecting first post-sale tx to succeed
            await txPromise;
        else
            await expectThrow(txPromise);
    }


    const paymentFunctions = [];
    paymentFunctions.push(['ff', (crowdsale, web3args) => crowdsale.sendTransaction(web3args)]);
    if (settings.extraPaymentFunction)
        paymentFunctions.push([settings.extraPaymentFunction, (crowdsale, web3args) => crowdsale[settings.extraPaymentFunction](web3args)]);
    if (settings.hasAnalytics)
        paymentFunctions.push(['analytics proxy', function(crowdsale, web3args){
            const address = crowdsale.testPaymentChannels[crowdsale.testNextPaymentChannel++];
            if (crowdsale.testNextPaymentChannel == crowdsale.testPaymentChannels.length)
                crowdsale.testNextPaymentChannel = 0;

            return AnalyticProxy.at(address).sendTransaction(web3args);
        }]);


    // tests

    const tests = [];


    tests.push(["test instantiation", async function() {
        const [sale, token, cash] = await ourInstantiate();
        assert.equal(await token.m_controller(), sale.address);
        await assertBalances(sale, token, cash, usingFund ? 0 : await web3.eth.getBalance(cash), 0);
    }]);


    if (paymentFunctions.length > 1) {
        tests.push(["test mixing payment functions", async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await getFundsBalance(funds);
            const expectedTokenBalances = {};

            if (settings.startTime)
                await crowdsale.setTime(settings.startTime + 1, {from: role.owner1});

            let tokens = new web3.BigNumber(0);
            for (const [paymentFunctionName, pay] of paymentFunctions) {
                await pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')});
                const paymentBonus = 'analytics proxy' == paymentFunctionName ? settings.analyticsPaymentBonus : 0;
                tokens = tokens.add(calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]));
            }

            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20 * paymentFunctions.length, 'finney'));
            expectedTokenBalances[role.investor1] = tokens;
            await assertTokenBalances(token, expectedTokenBalances);
        }]);
    }


    for (const [paymentFunctionName, pay] of paymentFunctions) {

        const paymentBonus = 'analytics proxy' == paymentFunctionName ? settings.analyticsPaymentBonus : 0;

        function testName(name) {
            return "{0} (payment function: {1})".format(name, paymentFunctionName);
        }

        tests.push([testName("test investments"), async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await getFundsBalance(funds);
            const expectedTokenBalances = {};
            if (settings.startTime) {
                // too early!
                await crowdsale.setTime(settings.startTime - 86400*365*2, {from: role.owner1});
                await expectThrow(pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')}));
                await crowdsale.setTime(settings.startTime - 1, {from: role.owner1});
                await expectThrow(pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')}));
            }

            // first investment at the first second
            if (settings.startTime)
                await crowdsale.setTime(settings.startTime, {from: role.owner1});
            await pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
            expectedTokenBalances[role.investor1] = calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);

            await assertTokenBalances(token, expectedTokenBalances);
            await expectThrow(pay(crowdsale, {from: role.nobody, value: web3.toWei(0, 'finney')}));
            assert.equal(await token.balanceOf(role.nobody), 0);
            // cant invest into other contracts
            await expectThrow(token.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));
            if (usingFund)
                await expectThrow(funds.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')}));

            // first investment of investor2
            if (settings.startTime)
                await crowdsale.setTime(settings.startTime + 100, {from: role.owner1});
            await pay(crowdsale, {from: role.investor2, value: web3.toWei(100, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(120, 'finney'));
            expectedTokenBalances[role.investor2] = calcTokens(web3.toWei(100, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);

            /*
             * Final investment of this test.
             * Care should be taken to reach soft cap and to know if hard cap was also reached and act accordingly.
             */
            if (settings.softCap && settings.hardCap)
                assert(new web3.BigNumber(settings.hardCap).gte(settings.softCap));

            let currentlyCollected = new web3.BigNumber(web3.toWei(120, 'finney'));
            let finalInvestment = settings.softCap && currentlyCollected.lt(settings.softCap) ?
                new web3.BigNumber(settings.softCap).sub(currentlyCollected) : new web3.BigNumber(web3.toWei(30, 'finney'));

            let change = new web3.BigNumber(0);
            if (settings.hardCap && currentlyCollected.add(finalInvestment).gt(settings.hardCap))
                change = currentlyCollected.add(finalInvestment).sub(settings.hardCap);
            const hardCapTriggered = settings.hardCap && currentlyCollected.add(finalInvestment).gte(settings.hardCap);

            // 2nd investment of investor1
            await pay(crowdsale, {from: role.investor1, value: finalInvestment, gasPrice: 0});

            currentlyCollected = currentlyCollected.add(finalInvestment);
            if (hardCapTriggered)
                currentlyCollected = new web3.BigNumber(settings.hardCap);
            await assertBalances(crowdsale, token, funds, cashInitial, currentlyCollected);

            expectedTokenBalances[role.investor1] = expectedTokenBalances[role.investor1].add(
                    calcTokens(finalInvestment.sub(change), settings.rate,
                            [settings.maxTimeBonus, paymentBonus]));
            await assertTokenBalances(token, expectedTokenBalances);
            if (! settings.tokenTransfersDuringSale)
                await checkNoTransfers(token);

            if (usingFund)
                await checkNotWithdrawing(crowdsale);

            if (!hardCapTriggered) {
                if (! settings.tokenTransfersDuringSale)
                    await checkNoTransfers(token);

                if (usingFund)
                    await checkNotSendingEther(funds);
            }

            // If hard cap is not triggered yet, testing late transaction
            if (settings.endTime && !hardCapTriggered) {
                // too late
                await crowdsale.setTime(settings.endTime, {from: role.owner1});
                await runFirstPostSaleTx(pay(crowdsale, {from: role.investor2, value: web3.toWei(20, 'finney')}));
                await assertBalances(crowdsale, token, funds, cashInitial, currentlyCollected);
                await assertTokenBalances(token, expectedTokenBalances);    // anyway, nothing gained
            }
            // If hard cap is triggered, sale is finished
            if (hardCapTriggered) {
                const txPromise = pay(crowdsale, {from: role.investor2, value: web3.toWei(20, 'finney')});
                if (!settings.postICOTxThrows)
                    await txPromise;
                else
                    await expectThrow(txPromise);
                await assertBalances(crowdsale, token, funds, cashInitial, currentlyCollected);
                await assertTokenBalances(token, expectedTokenBalances);    // anyway, nothing gained
            }

            if (settings.endTime || hardCapTriggered) {
                await checkNotInvesting(crowdsale, token, funds);
            }

            const totalSupply = await token.totalSupply();
            const totalSupplyExpected = Object.values(expectedTokenBalances).reduce((accumulator, currentValue) => accumulator.add(currentValue));
            assertBigNumberEqual(totalSupply, totalSupplyExpected);

            if (usingFund) {
                assert.equal(await funds.getInvestorsCount(), 2);
                assert.equal(await funds.m_investors(0), role.investor1);
                assert.equal(await funds.m_investors(1), role.investor2);
            }
        }]);


        if (settings.hardCap)
        tests.push([testName("test hard cap"), async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await getFundsBalance(funds);
            const expectedTokenBalances = {};

            if (settings.startTime)
                await crowdsale.setTime(settings.startTime, {from: role.owner1});

            await pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
            expectedTokenBalances[role.investor1] = calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);

            const investor3initial = await web3.eth.getBalance(role.investor3);
            await pay(crowdsale, {
                from: role.investor3,
                value: parseInt(settings.hardCap) + parseInt(web3.toWei(2000, 'finney')),
                gasPrice: 0
            });

            const investor3spent = investor3initial.sub(await web3.eth.getBalance(role.investor3));
            const expectedPayment = new web3.BigNumber(settings.hardCap).sub(web3.toWei(20, 'finney')).sub(settings.preCollectedFunds);
            assertBigNumberEqual(investor3spent, expectedPayment, 'change has to be sent');

            // optional assert.equal(await crowdsale.m_state(), 4);
            await assertBalances(crowdsale, token, funds, cashInitial,
                    new web3.BigNumber(settings.hardCap).sub(settings.preCollectedFunds));
            expectedTokenBalances[role.investor3] = calcTokens(expectedPayment, settings.rate,
                    [settings.maxTimeBonus, paymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);

            await checkNotInvesting(crowdsale, token, funds);
            if (usingFund)
                await checkNotWithdrawing(crowdsale);
        }]);

        if (settings.softCap) {
            if (!usingFund)
                throw new Error('softCap makes no sense without fund which can refund payments');
            if (! settings.endTime)
                throw new Error('softCap makes no sense without endTime');

            tests.push([testName("test soft cap"), async function() {
                const [crowdsale, token, funds] = await ourInstantiate();
                const cashInitial = await getFundsBalance(funds);
                if (settings.startTime)
                    await crowdsale.setTime(settings.startTime, {from: role.owner1});

                await pay(crowdsale, {from: role.investor1, value: web3.toWei(20, 'finney')});
                await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
                await pay(crowdsale, {from: role.investor2, value: web3.toWei(60, 'finney')});
                await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(80, 'finney'));
                // time is out
                await crowdsale.setTime(settings.endTime, {from: role.owner1});
                await runFirstPostSaleTx(pay(crowdsale, {from: role.investor1, value: web3.toWei(100, 'finney')}));
                await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(80, 'finney'));
                assert(web3.toBigNumber(web3.toWei(80, 'finney')).add(settings.preCollectedFunds).lt(settings.softCap));
                assert.equal(await funds.m_state(), 1);
                await expectThrow(
                    crowdsale[settings.usingFundCrowdsalewithdrawPaymentsMethod]({from: role.investor3})
                );
                await expectThrow(
                    crowdsale[settings.usingFundCrowdsalewithdrawPaymentsMethod]({from: role.owner3})
                );

                await crowdsale[settings.usingFundCrowdsalewithdrawPaymentsMethod]({from: role.investor2})
                await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
                await expectThrow(
                    crowdsale[settings.usingFundCrowdsalewithdrawPaymentsMethod]({from: role.nobody})
                );

                await checkNoTransfers(token);
                await checkNotInvesting(crowdsale, token, funds);
                await checkNotSendingEther(funds);

                await crowdsale[settings.usingFundCrowdsalewithdrawPaymentsMethod]({from: role.investor1})
                await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(0, 'finney'));
          }]);
        }
    }

    if (usingFund) {
        if (! settings.endTime)
            throw new Error('makes no sense to use fund without endTime');

        tests.push(["test sending ether", async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await getFundsBalance(funds);

            if (settings.startTime)
                await crowdsale.setTime(settings.startTime, {from: role.owner1});

            await crowdsale.sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));

            await crowdsale.sendTransaction({
                from: role.investor2,
                value: parseInt(settings.softCap) + parseInt(web3.toWei(100, 'finney'))
            });
            await assertBalances(crowdsale, token, funds, cashInitial, parseInt(settings.softCap) + parseInt(web3.toWei(120, 'finney')));

            // time is out
            await crowdsale.setTime(settings.endTime, {from: role.owner1});
            await runFirstPostSaleTx(crowdsale.sendTransaction({
                from: role.investor1,
                value: web3.toWei(100, 'finney')
            }));
            await assertBalances(crowdsale, token, funds, cashInitial, parseInt(settings.softCap) + parseInt(web3.toWei(120, 'finney')));
            //if (settings.softCap)
            //    assert(web3.toBigNumber(web3.toWei(120, 'finney')).add(settings.preCollectedFunds).gt(settings.softCap));

            await checkNotInvesting(crowdsale, token, funds);

            await checkNotWithdrawing(crowdsale);
            const x12125_initial = web3.eth.getBalance('0x1212500000000000000000000000000000000000');
            const x12126_initial = web3.eth.getBalance('0x1212600000000000000000000000000000000000');
            await runMultiSigTx(funds, funds.sendEther, ['0x1212500000000000000000000000000000000000', web3.toWei(40, 'finney')]);
            assertBigNumberEqual((await web3.eth.getBalance('0x1212500000000000000000000000000000000000')).sub(x12125_initial), web3.toWei(40, 'finney'));
            await assertBalances(crowdsale, token, funds, cashInitial, parseInt(settings.softCap) + parseInt(web3.toWei(80, 'finney')));

            await runMultiSigTx(funds, funds.sendEther, ['0x1212600000000000000000000000000000000000', web3.toWei(10, 'finney')]);

            assertBigNumberEqual((await web3.eth.getBalance('0x1212600000000000000000000000000000000000')).sub(x12126_initial), web3.toWei(10, 'finney'));
            await assertBalances(crowdsale, token, funds, cashInitial, parseInt(settings.softCap) + parseInt(web3.toWei(70, 'finney')));
            await runMultiSigTx(funds, funds.sendEther, ['0x1212500000000000000000000000000000000000', web3.toWei(55, 'finney')]);
            assertBigNumberEqual((await web3.eth.getBalance('0x1212500000000000000000000000000000000000')).sub(x12125_initial), web3.toWei(95, 'finney'));
            await assertBalances(crowdsale, token, funds, cashInitial, parseInt(settings.softCap) + parseInt(web3.toWei(15, 'finney')));
            await checkNotInvesting(crowdsale, token, funds);
            await checkNotWithdrawing(crowdsale);
        }]);
    }


    if (settings.hasAnalytics)
        tests.push(["test payment channels", async function() {
            const [crowdsale, token, funds] = await ourInstantiate();
            const cashInitial = await getFundsBalance(funds);
            const expectedTokenBalances = {};

            await expectThrow(crowdsale.createMorePaymentChannels(5, {from: role.investor3}));
            await expectThrow(crowdsale.createMorePaymentChannels(5, {from: role.nobody}));

            assert.equal(await crowdsale.paymentChannelsCount(), 5);
            const channel1 = await crowdsale.m_paymentChannels(0);
            const channel2 = await crowdsale.m_paymentChannels(1);
            const channel3 = await crowdsale.m_paymentChannels(2);

            if (settings.startTime)
                await crowdsale.setTime(settings.startTime + 2, {from: role.owner1});

            // investor1 -> channel3
            await AnalyticProxy.at(channel3).sendTransaction({from: role.investor1, value: web3.toWei(20, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(20, 'finney'));
            expectedTokenBalances[role.investor1] = calcTokens(web3.toWei(20, 'finney'), settings.rate,
                    [settings.maxTimeBonus, settings.analyticsPaymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(20, 'finney'));

            // investor2 -> channel2
            await AnalyticProxy.at(channel2).sendTransaction({from: role.investor2, value: web3.toWei(100, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(120, 'finney'));
            expectedTokenBalances[role.investor2] = calcTokens(web3.toWei(100, 'finney'), settings.rate,
                    [settings.maxTimeBonus, settings.analyticsPaymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(20, 'finney'));
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel2), web3.toWei(100, 'finney'));

            // investor3 -> channel3
            await AnalyticProxy.at(channel3).sendTransaction({from: role.investor3, value: web3.toWei(30, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(150, 'finney'));
            expectedTokenBalances[role.investor3] = calcTokens(web3.toWei(30, 'finney'), settings.rate,
                    [settings.maxTimeBonus, settings.analyticsPaymentBonus]);
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(50, 'finney'));
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel2), web3.toWei(100, 'finney'));

            // 2nd investment of investor1 -> channel3
            await AnalyticProxy.at(channel3).sendTransaction({from: role.investor1, value: web3.toWei(30, 'finney')});
            await assertBalances(crowdsale, token, funds, cashInitial, web3.toWei(180, 'finney'));
            expectedTokenBalances[role.investor1] = expectedTokenBalances[role.investor1].add(
                    calcTokens(web3.toWei(30, 'finney'), settings.rate, [settings.maxTimeBonus, settings.analyticsPaymentBonus]));
            await assertTokenBalances(token, expectedTokenBalances);
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel3), web3.toWei(80, 'finney'));
            assertBigNumberEqual(await crowdsale.m_investmentsByPaymentChannel(channel2), web3.toWei(100, 'finney'));

            await expectThrow(crowdsale.createMorePaymentChannels(5, {from: role.investor3}));
            await expectThrow(crowdsale.createMorePaymentChannels(5, {from: role.nobody}));
        }]);


    return tests;
}
