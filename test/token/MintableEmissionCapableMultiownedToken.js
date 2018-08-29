'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5

import {expectThrow} from 'openzeppelin-solidity/test/helpers/expectThrow';

const MintableEmissionCapableMultiownedTokenTestHelper = artifacts.require("../test_helpers/token/MintableEmissionCapableMultiownedTokenTestHelper.sol");
const l = console.log;

// Note: build artifact does not get rebuilt as MintableMultiownedToken changes (by some reason)
contract('MintableEmissionCapableMultiownedToken', function(accounts) {

    function getRoles() {
        return {
            minter: accounts[0],
            owner1: accounts[1],
            owner2: accounts[2],
            investor1: accounts[2],
            investor2: accounts[3],
            investor3: accounts[4],
            nobody: accounts[5]
        };
    }

    async function checkMintingOnlyByMinter(instance) {
        const role = getRoles();
        const initialBalance = await instance.totalSupply();

        for (let from_ of [role.owner1, role.owner2, role.investor1, role.investor2, role.nobody]) {
            await expectThrow(instance.mint(role.investor2, web3.toWei(5, 'ether'), {from: from_}));
            await expectThrow(instance.mint(role.nobody, web3.toWei(5, 'ether'), {from: from_}));
            await expectThrow(instance.mint(0, web3.toWei(5, 'ether'), {from: from_}));
        }

        assert((await instance.totalSupply()).eq(initialBalance));
    }

    async function checkIllegalTransfersThrows(instance) {
        const role = getRoles();

        for (let from_ of [role.owner1, role.owner2, role.investor1, role.investor2, role.nobody]) {
            const illegal = (await instance.balanceOf(from_)).add(web3.toWei(8, 'ether'));
            for (let target of [role.owner1, role.owner2, role.investor1, role.investor2, role.nobody])
                await expectThrow(instance.transfer(target, illegal, {from: from_}));
        }
    }

    it("test minting + emissions", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 2, role.minter, {from: role.nobody});

        await checkMintingOnlyByMinter(instance);

        // remember: actually its not ether but token
        // not using small numbers (like 100 instead of web3.toWei(5, 'ether')) on purpose
        await instance.mint(role.investor1, web3.toWei(5, 'ether'), {from: role.minter});
        assert.equal(await instance.totalSupply(), web3.toWei(5, 'ether'));
        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(5, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(0, 'ether'));

        await checkMintingOnlyByMinter(instance);

        await instance.mint(role.investor2, web3.toWei(8, 'ether'), {from: role.minter});
        assert.equal(await instance.totalSupply(), web3.toWei(13, 'ether'));
        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(5, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));

        await instance.mint(role.investor2, web3.toWei(10, 'ether'), {from: role.minter});
        assert.equal(await instance.totalSupply(), web3.toWei(23, 'ether'));
        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(5, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(18, 'ether'));

        await instance.mint(role.investor1, web3.toWei(1, 'ether'), {from: role.minter});
        assert.equal(await instance.totalSupply(), web3.toWei(24, 'ether'));
        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(6, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(18, 'ether'));

        await checkMintingOnlyByMinter(instance);

        // ok, its time to throw in some emissions

        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});
        assert.equal(await instance.totalSupply(), web3.toWei(24, 'ether'));
        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner2});   // 2nd signature
        assert.equal(await instance.totalSupply(), web3.toWei(30, 'ether'));

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(6, 'ether'), 'dividends must not be triggered yet');
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(18, 'ether'), 'dividends must not be triggered yet');
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(0, 'ether'));

        await instance.mint(role.investor1, web3.toWei(1, 'ether'), {from: role.minter});
        await instance.mint(role.investor3, web3.toWei(1, 'ether'), {from: role.minter});

        assert((await instance.balanceOf(role.investor1)).eq(web3.toWei(8.5, 'ether')), 'sum must be: pre-emission balance plus dividend(!) plus minted');
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(18, 'ether'), 'dividends must not be triggered yet');
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(1, 'ether'), 'sum must be: sole minted');
        assert.equal(await instance.totalSupply(), web3.toWei(32, 'ether'));

        await checkMintingOnlyByMinter(instance);

        // testing minting to accounts not touched for many emissions

        await instance.emission(web3.toWei(1, 'ether'), {from: role.owner1});
        await instance.emission(web3.toWei(1, 'ether'), {from: role.owner2});   // 2nd signature
        await instance.emission(web3.toWei(3, 'ether'), {from: role.owner1});
        await instance.emission(web3.toWei(3, 'ether'), {from: role.owner2});   // 2nd signature
        assert.equal(await instance.totalSupply(), web3.toWei(36, 'ether'));

        await instance.mint(role.investor1, web3.toWei(1, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(1, 'ether'), {from: role.minter});
        await instance.mint(role.investor3, web3.toWei(1, 'ether'), {from: role.minter});
        await instance.mint(role.owner1, web3.toWei(1, 'ether'), {from: role.minter});

        assert((await instance.balanceOf(role.investor1)).eq(web3.toWei(10.5625, 'ether')), 'sum must be: pre-emission balance plus dividend(!) plus minted');
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(26.3125, 'ether'), 'sum must be: pre-emission balance of 18 plus 3 emissions (with different ratio!) plus minted');
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(2.125, 'ether'), 'sum must be: pre-emission balance plus dividend(!) plus minted');
        assert.equal(await instance.balanceOf(role.owner1), web3.toWei(1, 'ether'), 'sum must be: sole minted');
        assert.equal(await instance.balanceOf(role.minter), web3.toWei(0, 'ether'));
        assert.equal(await instance.balanceOf(role.nobody), web3.toWei(0, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(40, 'ether'));

        await checkMintingOnlyByMinter(instance);
    });

    it("test minting + transfers", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 2, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(12, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(4, 'ether'), {from: role.minter});
        assert.equal(await instance.totalSupply(), web3.toWei(16, 'ether'));

        await checkIllegalTransfersThrows(instance);

        // 1st round of transfers
        await instance.transfer(role.investor3, web3.toWei(2, 'ether'), {from: role.investor1});
        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(10, 'ether'));
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(2, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(16, 'ether'));

        await instance.transfer(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});
        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(8, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(16, 'ether'));

        await checkMintingOnlyByMinter(instance);

        // 1st round of minting
        await instance.mint(role.investor1, web3.toWei(1, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(1, 'ether'), {from: role.minter});
        await instance.mint(role.investor3, web3.toWei(1, 'ether'), {from: role.minter});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(9, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(7, 'ether'));
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(3, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(19, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);

        // 2nd round of transfers
        await instance.transfer(role.investor1, web3.toWei(1, 'ether'), {from: role.investor3});
        await instance.transfer(role.investor2, web3.toWei(1, 'ether'), {from: role.investor3});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(10, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(1, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(19, 'ether'));

        // 2nd round of minting
        await instance.mint(role.investor1, web3.toWei(1, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(2, 'ether'), {from: role.minter});
        await instance.mint(role.investor3, web3.toWei(3, 'ether'), {from: role.minter});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(11, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(10, 'ether'));
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(4, 'ether'));
        assert.equal(await instance.balanceOf(role.minter), web3.toWei(0, 'ether'));
        assert.equal(await instance.balanceOf(role.owner1), web3.toWei(0, 'ether'));
        assert.equal(await instance.balanceOf(role.nobody), web3.toWei(0, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(25, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });


    it("test transferFrom", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 1, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(10, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(6, 'ether'), {from: role.minter});

        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(10, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(22, 'ether'));

        await instance.approve(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});
        await expectThrow(instance.transferFrom(role.investor1, role.investor3, web3.toWei(5, 'ether'), {from: role.investor2}));
        await instance.transferFrom(role.investor1, role.investor3, web3.toWei(2, 'ether'), {from: role.investor2});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(11.75, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'), 'dividends must not be triggered yet');
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(2, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(22.0, 'ether'));

        await instance.mint(role.investor1, web3.toWei(4, 'ether'), {from: role.minter});

        await instance.approve(role.investor2, web3.toWei(3, 'ether'), {from: role.investor1});
        await instance.transferFrom(role.investor1, role.investor2, web3.toWei(1, 'ether'), {from: role.investor2});
        await expectThrow(instance.transferFrom(role.investor1, role.investor2, web3.toWei(2.1, 'ether'), {from: role.investor2}));
        await expectThrow(instance.transferFrom(role.investor1, role.investor3, web3.toWei(2.1, 'ether'), {from: role.investor2}));
        await instance.transferFrom(role.investor1, role.investor2, web3.toWei(2, 'ether'), {from: role.investor2});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(12.75, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(11.25, 'ether'));
        assert.equal(await instance.balanceOf(role.investor3), web3.toWei(2, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26.0, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });

    it("test disableMinting", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 2, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(12, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(4, 'ether'), {from: role.minter});
        assert.equal(await instance.totalSupply(), web3.toWei(16, 'ether'));

        await instance.disableMinting({from: role.minter});

        await expectThrow(instance.mint(role.investor1, web3.toWei(12, 'ether'), {from: role.minter}));
        await expectThrow(instance.mint(role.owner1, web3.toWei(12, 'ether'), {from: role.minter}));
        await expectThrow(instance.mint(role.nobody, web3.toWei(12, 'ether'), {from: role.minter}));
    });


    it("test transfer,mint,emission", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 1, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(10, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(6, 'ether'), {from: role.minter});

        await instance.transfer(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(8, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(16, 'ether'));
        await instance.mint(role.investor1, web3.toWei(4, 'ether'), {from: role.minter});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(12, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(20, 'ether'));
        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(12, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });


    it("test transfer,emission,mint", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 1, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(10, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(6, 'ether'), {from: role.minter});

        await instance.transfer(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(8, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(16, 'ether'));
        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(8, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(22, 'ether'));
        await instance.mint(role.investor1, web3.toWei(4, 'ether'), {from: role.minter});
        await instance.requestDividends({from: role.investor2});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(15.0, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(11.0, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26.0, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });


    it("test mint,transfer,emission", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 1, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(10, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(6, 'ether'), {from: role.minter});

        await instance.mint(role.investor1, web3.toWei(4, 'ether'), {from: role.minter});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(14, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(20, 'ether'));
        await instance.transfer(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(12, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(20, 'ether'));
        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(12, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });


    it("test mint,emission,transfer", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 1, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(10, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(6, 'ether'), {from: role.minter});

        await instance.mint(role.investor1, web3.toWei(4, 'ether'), {from: role.minter});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(14, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(20, 'ether'));
        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(14, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26, 'ether'));
        await instance.transfer(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(16.2, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(9.8, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26.0, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });


    it("test emission,transfer,mint", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 1, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(10, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(6, 'ether'), {from: role.minter});

        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(10, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(22, 'ether'));
        await instance.transfer(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(11.75, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(10.25, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(22.0, 'ether'));
        await instance.mint(role.investor1, web3.toWei(4, 'ether'), {from: role.minter});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(15.75, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(10.25, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26.0, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });


    it("test emission,mint,transfer", async function() {
        const role = getRoles();

        const instance = await MintableEmissionCapableMultiownedTokenTestHelper.new([role.owner1, role.owner2], 1, role.minter, {from: role.nobody});

        await instance.mint(role.investor1, web3.toWei(10, 'ether'), {from: role.minter});
        await instance.mint(role.investor2, web3.toWei(6, 'ether'), {from: role.minter});

        await instance.emission(web3.toWei(6, 'ether'), {from: role.owner1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(10, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(6, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(22, 'ether'));
        await instance.mint(role.investor1, web3.toWei(4, 'ether'), {from: role.minter});
        await instance.requestDividends({from: role.investor2});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(17.75, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(8.25, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26.0, 'ether'));
        await instance.transfer(role.investor2, web3.toWei(2, 'ether'), {from: role.investor1});

        assert.equal(await instance.balanceOf(role.investor1), web3.toWei(15.75, 'ether'));
        assert.equal(await instance.balanceOf(role.investor2), web3.toWei(10.25, 'ether'));
        assert.equal(await instance.totalSupply(), web3.toWei(26.0, 'ether'));

        await checkMintingOnlyByMinter(instance);
        await checkIllegalTransfersThrows(instance);
    });
});
