'use strict';

import {expectThrow} from 'openzeppelin-solidity/test/helpers/expectThrow';

const BigNumber = web3.BigNumber;
const chai =require('chai');
chai.use(require('chai-bignumber')(BigNumber));
chai.use(require('chai-as-promised')); // Order is important
chai.should();

const Bonuses = artifacts.require("Bonuses");

contract('FixedTimeBonuses Library', function (accounts) {
  //const acc = {anyone: accounts[0], owner: accounts[1]};

  beforeEach(async function () {
    this.inst = await Bonuses.new();
  });

  describe('validation', function () {
    it('basic', async function() {
      await expectThrow(this.inst.validate(true));
      await expectThrow(this.inst.validate(false));

      await this.inst.add(1000000000, 50);
      await this.inst.validate(false);
      await this.inst.validate(true);

      await this.inst.add(1000000010, 40);
      await this.inst.validate(false);
      await this.inst.validate(true);

      await this.inst.add(999999, 60);
      await expectThrow(this.inst.validate(true));
      await expectThrow(this.inst.validate(false));
    });

    it('two equal timestamp different values', async function() {
      await this.inst.add(1000000000, 50);
      await this.inst.add(1000000000, 40);
      await expectThrow(this.inst.validate(true));
      await expectThrow(this.inst.validate(false));
    });

    it('two equal timestamp with different values in the middle of array', async function() {
      await this.inst.add(1000, 60);
      await this.inst.add(1000000000, 50);
      await this.inst.add(1000000000, 40);
      await this.inst.add(1000000010, 0);
      await expectThrow(this.inst.validate(true));
      await expectThrow(this.inst.validate(false));
    });

    it('same bonus', async function() {
      await this.inst.add(1000000000, 50);
      await this.inst.add(1000000001, 50);
      await this.inst.validate(false);
      await expectThrow(this.inst.validate(true));
    });

    it('same bonus in the middle', async function() {
      await this.inst.add(1000, 60);
      await this.inst.add(1000000000, 50);
      await this.inst.add(1000000001, 50);
      await this.inst.add(1000000010, 0);
      await this.inst.validate(false);
      await expectThrow(this.inst.validate(true));
    });

    it('value increases with time', async function() {
      await this.inst.add(1000000000, 50);
      await this.inst.add(1000000010, 60);
      await this.inst.validate(false);
      await expectThrow(this.inst.validate(true));
    });

    it('value increases with time somewhere in the middle', async function() {
      await this.inst.add(1000, 60);
      await this.inst.add(1000000000, 50);
      await this.inst.add(1000000010, 60);
      await this.inst.add(1000000020, 0);
      await this.inst.validate(false);
      await expectThrow(this.inst.validate(true));
    });
  });

  it('getLastTime', async function() {
    await this.inst.add(1000000000, 50);
    await this.inst.validate(true);
    await this.inst.getLastTime().should.be.eventually.bignumber.equal(1000000000);

    await this.inst.add(1000000010, 0);
    await this.inst.validate(true);
    await this.inst.getLastTime().should.be.eventually.bignumber.equal(1000000010);
  });

  it('getBonus', async function() {
    await this.inst.add(1000000000, 50);
    await this.inst.add(1000000010, 30);
    await this.inst.add(1000000020, 10);
    await this.inst.add(1000000030, 0);
    await this.inst.getBonus(0).should.be.eventually.bignumber.equal(50);
    await this.inst.getBonus(1000000000 - 1).should.be.eventually.bignumber.equal(50);
    await this.inst.getBonus(1000000000).should.be.eventually.bignumber.equal(50);

    await this.inst.getBonus(1000000001).should.be.eventually.bignumber.equal(30);
    await this.inst.getBonus(1000000009).should.be.eventually.bignumber.equal(30);
    await this.inst.getBonus(1000000010).should.be.eventually.bignumber.equal(30);

    await this.inst.getBonus(1000000011).should.be.eventually.bignumber.equal(10);

    await this.inst.getBonus(1000000029).should.be.eventually.bignumber.equal(0);
    await this.inst.getBonus(1000000030).should.be.eventually.bignumber.equal(0);

    await expectThrow(this.inst.getBonus(1000000333));
  });

});

