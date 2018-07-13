'use strict';

import expectThrow from '../helpers/expectThrow';

const DividendTokenTestHelper = artifacts.require("../test_helpers/token/DividendTokenTestHelper.sol");

const l = console.log;


contract('DividendToken', function(accounts) {

    function getRoles() {
        return {
            owner1: accounts[0],
            owner2: accounts[1],
            x: accounts[2],
            investor1: accounts[2],
            investor2: accounts[3],
            investor3: accounts[4],
            nobody: accounts[5]
        };
    }

    function assertBigNumberEqual(actual, expected, message=undefined) {
        assert(actual.eq(expected), "{2}expected {0}, but got: {1}".format(expected, actual,
            message ? message + ': ' : ''));
    }

    it("test requestDividends", async function() {
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});

        const initialTokenBalance = web3.eth.getBalance(token.address);

        let owner1Balance = await token.balanceOf(role.owner1);

        assert(owner1Balance.eq(50));

        await token.transfer(role.owner2, 2, {from: role.owner1});

        owner1Balance = await token.balanceOf(role.owner1);
        let owner2Balance = await token.balanceOf(role.owner2);

        assert(owner1Balance.eq(new web3.BigNumber(48)));
        assert(owner2Balance.eq(new web3.BigNumber(2)));

        // Now let's send some ether to token
        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(50, 'finney')}
        );

        const initialOwner1Balance = web3.eth.getBalance(role.owner1);
        const initialOwner2Balance = web3.eth.getBalance(role.owner2);

        await token.requestDividends({from: role.owner1, gasPrice: 0});
        await token.requestDividends({from: role.owner2, gasPrice: 0});

        // Nothing last at token ether balance
        assert(web3.eth.getBalance(token.address).eq(0));
        // Dividends were payed
        assert(web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(48, 'finney')));
        assert(web3.eth.getBalance(role.owner2).sub(initialOwner2Balance).eq(web3.toWei(2, 'finney')));
    });
});
