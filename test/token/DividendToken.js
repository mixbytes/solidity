'use strict';

import expectThrow from '../helpers/expectThrow';

const DividendTokenTestHelper = artifacts.require("../test_helpers/token/DividendTokenTestHelper.sol");
// Some contract that can't accept ether
const DummyContract = artifacts.require("../test_helpers/DummyHelper.sol");


const l = console.log;


contract('DividendToken', function(accounts) {

    function getRoles() {
        return {
            owner1: accounts[0],
            owner2: accounts[1],
            owner3: accounts[2],
            investor1: accounts[2],
            investor2: accounts[3],
            investor3: accounts[4],
            nobody: accounts[5]
        };
    }

    it("Test basis scenario", async function() {
        /* SCENARIO
         *
         * Creating token and minting some tokens to owner.
         * Transferring some tokens to another account and checking that they were transferred.
         * Then new investor came and send some ether to token.
         * Requesting dividends and checking that both owner got appropriate amount.
         * Then another investor came and send new ether to token.
         * After that owner fo tokens send some portion tokens to new account and we check that
         * new account can't request any dividends.
         */
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});
        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});

        const initialTokenBalance = web3.eth.getBalance(token.address);

        let owner1Balance = await token.balanceOf(role.owner1);

        assert(owner1Balance.eq(50), 'Tokens were minted to owner');

        await token.transfer(role.owner2, 2, {from: role.owner1, gasPrice: 0});

        owner1Balance = await token.balanceOf(role.owner1);
        let owner2Balance = await token.balanceOf(role.owner2);

        assert(owner1Balance.eq(new web3.BigNumber(48)), "Owner1 balance after transfer is ok");
        assert(owner2Balance.eq(new web3.BigNumber(2)), "Owner2 balance after transfer is ok");

        // Now let's send some ether to token
        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(50, 'finney')}
        );

        let initialOwner1Balance = web3.eth.getBalance(role.owner1);
        let initialOwner2Balance = web3.eth.getBalance(role.owner2);

        await token.requestDividends({from: role.owner1, gasPrice: 0});
        await token.requestDividends({from: role.owner2, gasPrice: 0});

        // Nothing last at token ether balance
        assert(web3.eth.getBalance(token.address).eq(0));
        // Dividends were payed
        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(48, 'finney')),
            "Owner1 got appropriate dividends"
        );
        assert(
            web3.eth.getBalance(role.owner2).sub(initialOwner2Balance).eq(web3.toWei(2, 'finney')),
            "Owner2 got appropriate dividends"
        );

        // Send yet another portion of ether
        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(50, 'finney')}
        );

        let initialOwner3Balance = web3.eth.getBalance(role.owner3);
        initialOwner1Balance = web3.eth.getBalance(role.owner1);

        // Transfer some tokens to new user
        await token.transfer(role.owner3, 10, {from: role.owner1, gasPrice: 0});

        // owner1 eth balance should increase by still 48
        // and owner 3 should get nothing
        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(48, 'finney')),
            "Owner1 gets his dividends again"
        );
        assert(
            web3.eth.getBalance(role.owner3).sub(initialOwner3Balance).eq(0),
            "new user has no dividends"
        );
    });

    it("Test multiple emissions", async function() {
        /* SCENARIO
         *
         * Mint tokens to owner and send some ether by investor.
         * Mint tokens to another account and again send some ethe to token.
         * then again Repeat it again with another account.
         */
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});

        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});
        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(50, 'finney')}
        );

        let initialOwner1Balance = web3.eth.getBalance(role.owner1);
        await token.requestDividends({from: role.owner1, gasPrice: 0});
        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(50, 'finney')),
            "Owner1 got appropriate dividends"
        );

        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});
        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(50, 'finney')}
        );

        assert(
           web3.eth.getBalance(token.address).eq(web3.toWei(50, 'finney')),
            "Token has appropriate ether balance"
        );

        initialOwner1Balance = web3.eth.getBalance(role.owner1);
        await token.requestDividends({from: role.owner1, gasPrice: 0});

        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(50, 'finney')),
            "Owner1 got appropriate dividends"
        );
     });

    it("Test multiple pays during one emission", async function() {
        /* SCENARIO
         *
         * Mint tokens to owner
         * Pay ether by investors several times
         * Request dividends once by the owner
         */
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});

        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});

        for (let i=0; i<5; ++i)  {
            await token.sendTransaction(
                {from: role.investor1, value: web3.toWei(50, 'finney')}
            );
        }

        let initialOwner1Balance = web3.eth.getBalance(role.owner1);
        await token.requestDividends({from: role.owner1, gasPrice: 0});
        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(250, 'finney')),
            "Owner1 got appropriate dividends"
        );
     });

    it("Test check gas limit with restriction on the number of transactions", async function() {
        /* SCENARIO
         *
         * 1. Mint tokens to owner
         * 2. Pay ether by investors several times
         * 3. repeat 1. and 2.  25 times
         * Request dividends by the owner and check that he received not everything and can
         * request again
         */
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});
        await token.mint(role.owner1, 1, {from: role.owner1, gasPrice: 0});

        let initialOwner1Balance = web3.eth.getBalance(role.owner1);
        let initialOwner2Balance = web3.eth.getBalance(role.owner2);

        for (let i=0; i<15; ++i)  {
            await token.mint(role.owner2, 1, {from: role.owner1, gasPrice: 0});

            await token.sendTransaction(
                {
                    from: role.investor2,
                    value: web3.toWei(2+i, 'finney'),
                    gasPrice: 0
                }
            );

            // Nothing was paid to owner1
            assert(
                web3.eth.getBalance(role.owner1).eq(initialOwner1Balance),
                "Nothing was paid to owner1"
            );

            // But owner2 got dividends because of minting
            assert(
                web3.eth.getBalance(role.owner2).sub(initialOwner2Balance).eq(
                    web3.toWei( i*(i+1)/2, 'finney')
                ),
                "Owner2 got dividends because of minting"
            );
        }

        await token.requestDividends({from: role.owner1, gasPrice: 0});

        // considering zero emission at constructor
        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).sub(web3.toWei(8, 'finney')).eq(0),
            "Owner1 got appropriate dividends first request"
        );

        await token.requestDividends({from: role.owner1, gasPrice: 0});

        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(15, 'finney')),
            "Owner1 got appropriate dividends second request"
        );
     });

    it("Test transfer works", async function() {
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});
        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});

        // somebody came and send ether
        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(50, 'finney')}
        );

        await token.transfer(role.owner2, 25, {from: role.owner1, gasPrice: 0});

        let owner1TokenBalance = await token.balanceOf(role.owner1);
        let owner2TokenBalance = await token.balanceOf(role.owner2);

        assert(
            owner1TokenBalance.eq(25),
            "Owner1 has appropriate number of tokens"
        );

        assert(
            owner2TokenBalance.eq(25),
            "Owner2 has appropriate number of tokens"
        );
     });

    it("Test transfer to oneself works and dividends are payed correctly", async function() {
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});

        let initialOwner1Balance = web3.eth.getBalance(role.owner1);

        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});

        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(100, 'finney')}
        );

        await token.transfer(role.owner1, 25, {from: role.owner1, gasPrice: 0});

        let owner1TokenBalance = await token.balanceOf(role.owner1);

        assert(
            owner1TokenBalance.eq(50),
            "Owner1 has appropriate number of tokens"
        );

        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(100, 'finney')),
            "Owner1 got appropriate dividends"
        );
     });

    it("Test transferFrom to oneself works and dividends are payed correctly", async function() {
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});

        let initialOwner1Balance = web3.eth.getBalance(role.owner1);
        let initialOwner2Balance = web3.eth.getBalance(role.owner2);

        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});

        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(100, 'finney')}
        );

        await token.approve(role.owner2, 20, {from: role.owner1, gasPrice: 0});

        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(100, 'finney')}
        );

        await token.transferFrom(role.owner1, role.owner2, 15, {from: role.owner2, gasPrice: 0});

        let owner1TokenBalance = await token.balanceOf(role.owner1);
        let owner2TokenBalance = await token.balanceOf(role.owner2);

        assert(owner1TokenBalance.eq(35), "Owner1 has appropriate number of tokens");
        assert(owner2TokenBalance.eq(15), "Owner2 has appropriate number of tokens");

        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(200, 'finney')),
            "Owner1 got appropriate dividends"
        );

        assert(
            web3.eth.getBalance(role.owner2).sub(initialOwner2Balance).eq(web3.toWei(0, 'finney')),
            "Owner2 got nothing"
        );

        initialOwner1Balance = web3.eth.getBalance(role.owner1);

        // Now let's transfer lasting 5 tokens from owner to owner just to check
        await token.transferFrom(role.owner1, role.owner1, 5, {from: role.owner2, gasPrice: 0});
        assert(owner1TokenBalance.eq(35), "Owner1 has appropriate number of tokens");
        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(0, 'finney')),
            "Owner1 got nothing second time"
        );
     });

    it("Hanging dividends", async function() {
        const role = getRoles();

        const token = await DividendTokenTestHelper.new({from: role.owner1});
        const dummyContract = await DummyContract.new({from: role.owner2});

        let initialOwner1Balance = web3.eth.getBalance(role.owner1);

        await token.mint(role.owner1, 50, {from: role.owner1, gasPrice: 0});

        await token.transfer(dummyContract.address, 19, {from: role.owner1, gasPrice: 0});
        await token.transfer(dummyContract.address, 1, {from: role.owner1, gasPrice: 0});

        // somebody came and send ether
        await token.sendTransaction(
            {from: role.investor1, value: web3.toWei(100, 'finney')}
        );

        let result = await token.transfer(dummyContract.address, 5, {from: role.owner1, gasPrice: 0});

        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(60, 'finney')),
            "Owner1 got nothing second time"
        );

        let hangingDividendsEventExists = false;
        for (let log of result.logs) {
            if(log.event == 'HangingDividend')
                hangingDividendsEventExists = true;
        }

        assert(hangingDividendsEventExists, "HangingDividend event must be recorded")

        let owner1TokenBalance = await token.balanceOf(role.owner1);
        let dummyContractTokenBalance = await token.balanceOf(dummyContract.address);

        assert(
            owner1TokenBalance.eq(25),
            "Owner1 has appropriate number of tokens"
        );

        assert(
            dummyContractTokenBalance.eq(25),
            "dummy contract has appropriate number of tokens"
        );

        await token.requestHangingDividends({from: role.owner1, gasPrice: 0});

        assert(
            web3.eth.getBalance(role.owner1).sub(initialOwner1Balance).eq(web3.toWei(100, 'finney')),
            "Owner1 got hanging dividends"
        );
     });

});
