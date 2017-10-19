'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5

import {l, logEvents} from '../helpers/debug';
import '../helpers/typeExt';

const InvestmentAnalytics = artifacts.require("./crowdsale/InvestmentAnalyticsTestHelper.sol");
const AnalyticProxy = artifacts.require("AnalyticProxy");


contract('InvestmentAnalytics', function(accounts) {

    it("test simple", async function() {
        const instance = await InvestmentAnalytics.new({from: accounts[0]});
        await instance.createMorePaymentChannels(10, {from: accounts[0]});

        assert.equal(await instance.paymentChannelsCount(), 10);
        const paymentChannel1 = await instance.m_paymentChannels(1);
        const paymentChannel5 = await instance.m_paymentChannels(5);

        await AnalyticProxy.at(paymentChannel1).sendTransaction({from: accounts[1], value: web3.toWei(20, 'finney')});
        await AnalyticProxy.at(paymentChannel5).sendTransaction({from: accounts[2], value: web3.toWei(50, 'finney')});
        await AnalyticProxy.at(paymentChannel1).sendTransaction({from: accounts[3], value: web3.toWei(20, 'finney')});

        assert.equal(await instance.m_investmentsByPaymentChannel(paymentChannel1), web3.toWei(40, 'finney'));
        assert.equal(await instance.m_investmentsByPaymentChannel(paymentChannel5), web3.toWei(50, 'finney'));

        // missing analytics in case of direct payments
        await instance.iaInvestedBy(0x11, {from: accounts[3], value: web3.toWei(6, 'finney')});
        await instance.iaInvestedBy(0x12, {from: accounts[4], value: web3.toWei(7, 'finney')});

        assert.equal(await instance.m_investmentsByPaymentChannel(paymentChannel1), web3.toWei(40, 'finney'));
        assert.equal(await instance.m_investmentsByPaymentChannel(paymentChannel5), web3.toWei(50, 'finney'));
        const expectedEmptyChannels = [];
        for (let channel of [0, 2, 3, 4, 6, 7, 8, 9]) {
            const channelAddress = await instance.m_paymentChannels(channel);
            expectedEmptyChannels.push(channelAddress);
            assert.equal(await instance.m_investmentsByPaymentChannel(channelAddress), 0);
        }
        assert.equal(await web3.eth.getBalance(instance.address), web3.toWei(103, 'finney'));

        // readAnalyticsMap test
        assert.deepEqual(Object.fromKeysValues(... await instance.readAnalyticsMap()), Object.fromIterable([
            [paymentChannel1, new web3.BigNumber(web3.toWei(40, 'finney'))],
            [paymentChannel5, new web3.BigNumber(web3.toWei(50, 'finney'))]
        ].concat(expectedEmptyChannels.map(addr => [addr, new web3.BigNumber(0)]))));
    });

    it("test creation gas usage", async function() {
        const instance = await InvestmentAnalytics.new({from: accounts[0]});
        await instance.createMorePaymentChannels(100, {from: accounts[0], gas: 0x47E7C4});
        assert.equal(await instance.paymentChannelsCount(), 27);
    });
});
