'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4

import {expectThrow} from 'openzeppelin-solidity/test/helpers/expectThrow';

const FundsRegistry = artifacts.require("./FundsRegistry.sol");
const l = console.log;

contract('FundsRegistry', function(accounts) {

    function getRoles() {
        return {
            controller: accounts[0],
            owner1: accounts[1],
            owner2: accounts[2],
            investor1: accounts[2],
            investor2: accounts[3],
            nobody: accounts[4]
        };
    }

    async function checkPaymentsCantBeWithdrawn(instance) {
        const role = getRoles();
        const initialBalance = web3.eth.getBalance(instance.address);

        for (let payee of [role.controller, role.investor2, role.nobody]) {
            await expectThrow(instance.withdrawPayments(payee, {from: payee}));
            await expectThrow(instance.withdrawPayments(payee, {from: role.controller}));
        }

        assert(await web3.eth.getBalance(instance.address).eq(initialBalance));
    }

    async function checkInvestmentsCantBeMade(instance) {
        const role = getRoles();
        const initialBalance = web3.eth.getBalance(instance.address);

        for (let from_ of [role.controller, role.owner1, role.investor2, role.nobody])
            for (let by_ of [role.owner1, role.investor1, role.controller, role.nobody, 0]) {
                await expectThrow(instance.invested(by_, {from: from_, value: web3.toWei(2, 'finney')}));
            }

        assert(await web3.eth.getBalance(instance.address).eq(initialBalance));
    }

    async function checkEtherCantBeSent(instance) {
        const role = getRoles();
        const initialBalance = web3.eth.getBalance(instance.address);

        for (let target of [role.owner1, role.investor2, role.nobody]) {
            await instance.sendEther(target, web3.toWei(5, 'finney'), {from: role.owner1});
            await expectThrow(instance.sendEther(target, web3.toWei(5, 'finney'), {from: role.owner2}));
        }

        for (let from_ of [role.controller, role.investor2, role.nobody])
            for (let target of [role.owner1, role.investor1, role.nobody]) {
                await expectThrow(instance.sendEther(target, web3.toWei(5, 'finney'), {from: from_}));
            }

        assert(await web3.eth.getBalance(instance.address).eq(initialBalance));
    }

    it("test state changes", async function() {
        const role = getRoles();

        let instance = await FundsRegistry.new([role.owner1, role.owner2], 2, role.controller, {from: role.nobody});
        await expectThrow(instance.changeState(0, {from: role.controller}));
        await expectThrow(instance.changeState(4, {from: role.controller}));

        instance = await FundsRegistry.new([role.owner1, role.owner2], 2, role.controller, {from: role.nobody});
        await instance.changeState(1, {from: role.controller});
        await expectThrow(instance.changeState(0, {from: role.controller}));
        await expectThrow(instance.changeState(1, {from: role.controller}));
        await expectThrow(instance.changeState(2, {from: role.controller}));
        await expectThrow(instance.changeState(4, {from: role.controller}));

        instance = await FundsRegistry.new([role.owner1, role.owner2], 2, role.controller, {from: role.nobody});
        await instance.changeState(2, {from: role.controller});
        await expectThrow(instance.changeState(0, {from: role.controller}));
        await expectThrow(instance.changeState(1, {from: role.controller}));
        await expectThrow(instance.changeState(2, {from: role.controller}));
        await expectThrow(instance.changeState(4, {from: role.controller}));
    });

    it("test investments", async function() {
        const role = getRoles();

        const instance = await FundsRegistry.new([role.owner1, role.owner2], 2, role.controller, {from: role.nobody});
        assert.equal(await instance.getInvestorsCount(), 0);

        // first, checking empty fund

        // checking rights: investments kept only by controller
        async function checkControlledOnlyByController() {
            await expectThrow(instance.invested(role.owner1, {from: role.owner1, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.owner2, {from: role.owner2, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.investor1, {from: role.investor1, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.investor2, {from: role.investor2, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.nobody, {from: role.nobody, value: web3.toWei(5, 'finney')}));

            await expectThrow(instance.invested(0, {from: role.nobody, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(0, {from: role.owner1, value: web3.toWei(5, 'finney')}));

            await expectThrow(instance.invested(role.owner2, {from: role.owner1, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.nobody, {from: role.owner2, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.investor2, {from: role.investor1, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.nobody, {from: role.investor2, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.owner1, {from: role.nobody, value: web3.toWei(5, 'finney')}));
            await expectThrow(instance.invested(role.investor2, {from: role.nobody, value: web3.toWei(5, 'finney')}));
        }

        await checkControlledOnlyByController();
        await checkEtherCantBeSent(instance);
        await checkPaymentsCantBeWithdrawn(instance);

        // its time to make some investments

        await instance.invested(role.investor1, {from: role.controller, value: web3.toWei(5, 'finney')});

        assert.equal(await instance.getInvestorsCount(), 1);
        assert.equal(await instance.m_investors(0), role.investor1);
        assert.equal(await instance.m_weiBalances(role.investor1), web3.toWei(5, 'finney'));
        assert.equal(await instance.totalInvested(), web3.toWei(5, 'finney'));


        await instance.invested(role.investor2, {from: role.controller, value: web3.toWei(7, 'finney')});

        assert.equal(await instance.getInvestorsCount(), 2);
        assert.equal(await instance.m_investors(0), role.investor1);
        assert.equal(await instance.m_investors(1), role.investor2);
        assert.equal(await instance.m_weiBalances(role.investor1), web3.toWei(5, 'finney'));
        assert.equal(await instance.m_weiBalances(role.investor2), web3.toWei(7, 'finney'));
        assert.equal(await instance.totalInvested(), web3.toWei(12, 'finney'));

        await checkControlledOnlyByController();
        await checkEtherCantBeSent(instance);
        await checkPaymentsCantBeWithdrawn(instance);


        await instance.invested(role.investor2, {from: role.controller, value: web3.toWei(1, 'finney')});

        assert.equal(await instance.getInvestorsCount(), 2);
        assert.equal(await instance.m_investors(0), role.investor1);
        assert.equal(await instance.m_investors(1), role.investor2);
        assert.equal(await instance.m_weiBalances(role.investor1), web3.toWei(5, 'finney'));
        assert.equal(await instance.m_weiBalances(role.investor2), web3.toWei(8, 'finney'));
        assert.equal(await instance.totalInvested(), web3.toWei(13, 'finney'));


        await instance.invested(role.investor1, {from: role.controller, value: web3.toWei(2, 'finney')});

        assert.equal(await instance.getInvestorsCount(), 2);
        assert.equal(await instance.m_investors(0), role.investor1);
        assert.equal(await instance.m_investors(1), role.investor2);
        assert.equal(await instance.m_weiBalances(role.investor1), web3.toWei(7, 'finney'));
        assert.equal(await instance.m_weiBalances(role.investor2), web3.toWei(8, 'finney'));
        assert.equal(await instance.totalInvested(), web3.toWei(15, 'finney'));

        await checkControlledOnlyByController();
        await checkEtherCantBeSent(instance);
        await checkPaymentsCantBeWithdrawn(instance);

        // final check

        assert((await instance.totalInvested()).eq(await web3.eth.getBalance(instance.address)));
    });

    it("test sending ether", async function() {
        const role = getRoles();

        const instance = await FundsRegistry.new([role.owner1, role.owner2], 2, role.controller, {from: role.nobody});

        await instance.invested(role.investor1, {from: role.controller, value: web3.toWei(5, 'finney')});
        await instance.invested(role.investor2, {from: role.controller, value: web3.toWei(7, 'finney')});
        await instance.invested(role.investor2, {from: role.controller, value: web3.toWei(1, 'finney')});
        await instance.invested(role.investor1, {from: role.controller, value: web3.toWei(2, 'finney')});
        assert.equal(await instance.totalInvested(), web3.toWei(15, 'finney'));

        await instance.changeState(2, {from: role.controller});

        await checkInvestmentsCantBeMade(instance);
        await checkPaymentsCantBeWithdrawn(instance);

        for (let target of [role.owner1, role.investor2, role.nobody]) {
            await instance.sendEther(target, web3.toWei(2, 'finney'), {from: role.owner1});
            let initial = await web3.eth.getBalance(target);
            await instance.sendEther(target, web3.toWei(2, 'finney'), {from: role.owner2});
            assert((await web3.eth.getBalance(target)).sub(initial).eq(web3.toWei(2, 'finney')));
        }

        for (let from_ of [role.controller, role.investor2, role.nobody])
            for (let target of [role.owner1, role.investor1, role.nobody]) {
                await expectThrow(instance.sendEther(target, web3.toWei(1, 'finney'), {from: from_}));
            }

        assert(await web3.eth.getBalance(instance.address).eq(web3.toWei(9, 'finney')));

        await checkInvestmentsCantBeMade(instance);
        await checkPaymentsCantBeWithdrawn(instance);

        // testing controller retirement
        for (let from_ of [role.owner1, role.investor2, role.nobody])
            await expectThrow(instance.detachController({from: from_}));

        await instance.detachController({from: role.controller});

        for (let from_ of [role.controller, role.owner1, role.investor2, role.nobody])
            await expectThrow(instance.detachController({from: from_}));
    });

    it("test refunding", async function() {
        const role = getRoles();

        const instance = await FundsRegistry.new([role.owner1, role.owner2], 2, role.controller, {from: role.nobody});

        await instance.invested(role.investor1, {from: role.controller, value: web3.toWei(5, 'finney')});
        await instance.invested(role.investor2, {from: role.controller, value: web3.toWei(7, 'finney')});
        await instance.invested(role.investor2, {from: role.controller, value: web3.toWei(1, 'finney')});
        await instance.invested(role.investor1, {from: role.controller, value: web3.toWei(2, 'finney')});
        assert.equal(await instance.totalInvested(), web3.toWei(15, 'finney'));

        await instance.changeState(1, {from: role.controller});

        await checkInvestmentsCantBeMade(instance);
        await checkEtherCantBeSent(instance);

        for (let from_ of [role.controller, role.owner1, role.nobody]) {
            await expectThrow(instance.withdrawPayments(from_, {from: role.controller}));
            await expectThrow(instance.withdrawPayments(from_, {from: from_}));
        }

        let initial = await web3.eth.getBalance(role.investor1);
        let controllerInitial = await web3.eth.getBalance(role.controller);

        await instance.withdrawPayments(role.investor1, {from: role.controller});
        assert.equal(await instance.totalInvested(), web3.toWei(8, 'finney'));
        assert(await web3.eth.getBalance(instance.address).eq(web3.toWei(8, 'finney')));

        let refund = (await web3.eth.getBalance(role.investor1)).sub(initial);

        // paid for gas for withdrawPayments call, so refund smaller than 7
        assert(refund.eq(web3.toWei(7, 'finney')));

        // Check that controller paid some gas for withdraw
        let controllerCurrent = await web3.eth.getBalance(role.controller);
        assert(controllerCurrent.lt(controllerInitial));

        await checkInvestmentsCantBeMade(instance);
        await checkEtherCantBeSent(instance);

        // No, investor can't withdraw directly, just through controller
        await expectThrow(instance.withdrawPayments(role.investor2, {from: role.investor2}));

        initial = await web3.eth.getBalance(role.investor2);
        await instance.withdrawPayments(role.investor2, {from: role.controller});
        assert.equal(await instance.totalInvested(), web3.toWei(0, 'finney'));
        assert(await web3.eth.getBalance(instance.address).eq(web3.toWei(0, 'finney')));

        refund = (await web3.eth.getBalance(role.investor2)).sub(initial);

        assert(refund.eq(web3.toWei(8, 'finney')));
    });
});
