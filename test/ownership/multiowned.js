'use strict';

// testrpc has to be run as testrpc -u 0 -u 1 -u 2 -u 3

import {expectThrow} from 'openzeppelin-solidity/test/helpers/expectThrow';

const multiowned = artifacts.require("./multiowned.sol");
const l = console.log;

contract('multiowned', function(accounts) {

    async function freshInstance(required=2) {
        return multiowned.new([accounts[0], accounts[1], accounts[2]], required, {from: accounts[0]});
    }

    function skipHexPrefix(str) {
        return str.match(/^0[xX]/) ? str.substring(2) : str;
    }
    function paddedArg(str) {
        // pad to bytes32
        return str.padStart(64, '0');
    }

    const changeOwnerSelector = skipHexPrefix(web3.sha3('changeOwner(address,address)')).substring(0, 8);
    // Make calldata for changeOwner function and get its hash, which is used as an operation key
    function makeChangeOwnerOpHash(_from, _to) {
        /* requires web3 1.0+
        web3.eth.abi.encodeFunctionCall({"constant":false,
            "inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"}],
            "name":"changeOwner",
            "outputs":[],
            "payable":false,"stateMutability":"nonpayable","type":"function"
        }, [accounts[1], accounts[3]]); */

        return web3.sha3(changeOwnerSelector + paddedArg(skipHexPrefix(_from)) + paddedArg(skipHexPrefix(_to)), {encoding: 'hex'});
    }

    async function getOwners(instance) {
        const totalOwners = (await instance.m_numOwners()).toNumber();
        const calls = [];
        for (let i = 0; i < totalOwners; i++)
            calls.push(instance.getOwner(i));
        return Promise.all(calls);
    }

    it("ctor check", async function() {
        await expectThrow(multiowned.new([accounts[0], accounts[1], accounts[2]], 20, {from: accounts[0]}));
        await expectThrow(multiowned.new([accounts[0], accounts[1], accounts[0]], 1, {from: accounts[0]}));
        await expectThrow(multiowned.new([accounts[0], accounts[1], 0], 1, {from: accounts[0]}));

        let instance = await multiowned.new([accounts[0]], 1, {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0]]);

        instance = await multiowned.new([accounts[0], accounts[1]], 2, {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1]]);

        instance = await freshInstance();
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]]);
        assert.deepEqual(await instance.getOwners(), [accounts[0], accounts[1], accounts[2]]);
    });

    it("changeOwner check", async function() {
        const instance = await freshInstance(1);

        await expectThrow(instance.changeOwner(accounts[1], accounts[3], {from: accounts[3]}));

        await expectThrow(instance.changeOwner('0x0000000000000000000000000000000000000012', accounts[3], {from: accounts[0]}));
        await expectThrow(instance.changeOwner(accounts[1], accounts[2], {from: accounts[0]}));

        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[3], accounts[2]]);
    });

    it("double-signed changeOwner check", async function() {
        const instance = await freshInstance();

        // first signature
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');

        // makes no sense to sign again, accounts[0]!
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');

        // second signature
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[2]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[3], accounts[2]],
            'owners has been changed');
    });

    it("addOwner check", async function() {
        const instance = await freshInstance(1);

        await expectThrow(instance.addOwner(accounts[3], {from: accounts[3]}));
        await expectThrow(instance.addOwner(accounts[1], {from: accounts[0]}));

        await instance.addOwner(accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2], accounts[3]]);
    });

    it("removeOwner check", async function() {
        const instance = await freshInstance(1);

        await expectThrow(instance.removeOwner(accounts[1], {from: accounts[3]}));
        await expectThrow(instance.removeOwner(accounts[3], {from: accounts[0]}));

        await instance.removeOwner(accounts[1], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[2]]);
    });


    it("isOwner check", async function() {
        const instance = await freshInstance();

        assert(await instance.isOwner(accounts[0]));
        assert(await instance.isOwner(accounts[1]));
        assert(await instance.isOwner(accounts[2]));

        assert(false === (await instance.isOwner(accounts[3])));
        assert(false === (await instance.isOwner('0x12')));
    });

    it("amIOwner check", async function() {
        const instance = await freshInstance();

        assert(await instance.amIOwner({from: accounts[0]}));
        assert(await instance.amIOwner({from: accounts[1]}));
        assert(await instance.amIOwner({from: accounts[2]}));

        await expectThrow(instance.amIOwner({from: accounts[3]}));
        await expectThrow(instance.amIOwner({from: '0x0000000000000000000000000000000000000012'}));
    });

    it("changeRequirement check", async function() {
        const instance = await freshInstance(1);

        await expectThrow(instance.changeRequirement(2, {from: accounts[3]}));

        await expectThrow(instance.changeRequirement(0, {from: accounts[0]}));
        await expectThrow(instance.changeRequirement(4, {from: accounts[0]}));

        await instance.changeRequirement(3, {from: accounts[0]});
        assert.equal(await instance.m_multiOwnedRequired(), 3);
    });

    it("revoke check", async function() {
        const instance = await freshInstance();

        // first signature
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');

        const opHash = makeChangeOwnerOpHash(accounts[1], accounts[3]);
        assert(await instance.hasConfirmed(opHash, accounts[0]));
        assert(! await instance.hasConfirmed(opHash, accounts[2]));

        // revoke-confirm
        await instance.revoke(opHash, {from: accounts[0]});
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');
        assert(await instance.hasConfirmed(opHash, accounts[0]));
        assert(! await instance.hasConfirmed(opHash, accounts[2]));

        await expectThrow(instance.revoke(opHash, {from: accounts[3]}));

        // revoke
        await instance.revoke(opHash, {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');
        assert(! await instance.hasConfirmed(opHash, accounts[0]));
        assert(! await instance.hasConfirmed(opHash, accounts[2]));

        // second signature (but first was revoked!)
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[2]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');
        assert(! await instance.hasConfirmed(opHash, accounts[0]));
        assert(await instance.hasConfirmed(opHash, accounts[2]));
    });

    it("complex (3 sigs required) check", async function() {
        const instance = await freshInstance(3);
        const opHash = makeChangeOwnerOpHash(accounts[1], accounts[3]);

        // first signature
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');

        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[1]});

        assert(await instance.hasConfirmed(opHash, accounts[0]));
        assert(await instance.hasConfirmed(opHash, accounts[1]));
        assert(! await instance.hasConfirmed(opHash, accounts[2]));

        await instance.revoke(opHash, {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');
        assert(! await instance.hasConfirmed(opHash, accounts[0]));
        assert(await instance.hasConfirmed(opHash, accounts[1]));
        assert(! await instance.hasConfirmed(opHash, accounts[2]));

        // second signature (but first was revoked!)
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[2]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[1], accounts[2]],
            'owners are the same');
        assert(! await instance.hasConfirmed(opHash, accounts[0]));
        assert(await instance.hasConfirmed(opHash, accounts[1]));
        assert(await instance.hasConfirmed(opHash, accounts[2]));

        // finally changing owner
        await instance.changeOwner(accounts[1], accounts[3], {from: accounts[0]});
        assert.deepEqual(await getOwners(instance), [accounts[0], accounts[3], accounts[2]]);
    });

});
