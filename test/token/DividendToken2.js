'use strict';

import expectThrow from 'openzeppelin-solidity/test/helpers/expectThrow';

const BigNumber = web3.BigNumber;
import should from '../helpers/chai';

const DividendTokenBasic = artifacts.require("../test_helpers/token/DividendTokenBasic.sol");
const PublicSelfDestructor = artifacts.require("../test_helpers/PublicSelfDestructor.sol");
//const UnpayapleContract = artifacts.require("../test_helpers/DummyHelper.sol");

async function assertBalanceDiff(callInfo, assertInfo) {
	const gasPrice = 'gasPrice' in callInfo ? callInfo.gasPrice : 0;
		//console.dir(callInfo);

	const watchList = (typeof(assertInfo) === "object") ? assertInfo : {[callInfo.address]: assertInfo};
	const etherBefore = web3.eth.getBalance(callInfo.address);
	let history = {};
	Reflect.ownKeys(watchList).forEach(addr => {
		history[addr] = {before: new BigNumber(web3.eth.getBalance(addr)), wantDiff: watchList[addr],};
	});

	const ret = await callInfo.func(...callInfo.args, {from: callInfo.address, gasPrice});
	const gasUsed = new BigNumber(ret.receipt.gasUsed);

	const etherAfter = web3.eth.getBalance(callInfo.address);
	const etherUsed = gasUsed.mul(gasPrice);
	//etherAfter.sub(etherBefore).add(etherUsed).should.be.bignumber.equal(wantEtherDiff);

	Reflect.ownKeys(history).forEach(addr => {
		let diff = (new BigNumber(web3.eth.getBalance(addr))).sub(history[addr].before);
		if (addr === callInfo.address) {
			diff = diff.add(etherUsed);
		}
		diff.should.be.bignumber.equal(history[addr].wantDiff);
	});
}

function getRoles(accounts) {
	return [
		'owner', 'investor1', 'holder1', 'investor2', 'holder2', 'investor3', 'holder3'
	].reduce((o, key, i) => {o[key] = accounts[i]; return o;}, {});
}

function newTestCase(inst, acc) {
	let obj = {inst, acc};
	obj.balanceDiffExtend = function (balanceDiffs) {
		if (! balanceDiffs) return {};
		return Reflect.ownKeys(balanceDiffs).reduce((o, name, i) => {
			o[this.acc[name]] = balanceDiffs[name];
			return o;
		}, {});
	};
	obj.requestDividends = async function (opt) { //(who, balanceDiffs) {
		const requestInfo = {
			func: this.inst.requestDividends,
			args: [], address: this.toAddr(opt.from),
		};
		await assertBalanceDiff(requestInfo, this.balanceDiffExtend(opt.etherDiff));
	};
	obj.toAddr = function (addr) {
		return (addr in this.acc) ? this.acc[addr] : addr;
	};
	obj.transfer = async function (opt) {
		const requestInfo = {
			func: this.inst.transfer, 
			args: [this.toAddr(opt.args[0]), opt.args[1]], 
			address: this.toAddr(opt.from)
		};
		await assertBalanceDiff(requestInfo, this.balanceDiffExtend(opt.etherDiff));
	};
	obj.putEther = async function (opt) {
		await this.inst.sendTransaction({from: this.toAddr(opt.from), value: opt.args[0]});
	};
	obj.forcedPutEther = async function (opt) {
		const value = opt.args[0];
		const komikadze = await PublicSelfDestructor.new();
		const etherBefore = web3.eth.getBalance(this.inst.address);
		await komikadze.SendEtherAndDie(this.inst.address, {from: this.toAddr(opt.from), value});
		const diff = web3.eth.getBalance(this.inst.address).sub(etherBefore);
		diff.should.be.bignumber.equal(value);
	};
	obj.assertPlanStepOk = async function (step) {
		const method = this[step.call].bind(this);
		await method(step);
	};
	obj.assertPlanWorks = async function (plan) {
		for(const step of plan) {
			if (typeof(step) === 'function') {
				await step(this.inst, this.acc);
			} else {
				await this.assertPlanStepOk(step);
			}
		} 
	};
	return obj;
}

contract('DividendToken audit', function(accounts) {
	const acc = getRoles(accounts);
	const totalSupply = new BigNumber(web3.toWei('1000', 'ether'));
	const halfSupply = totalSupply.div(2);
	const quarterSupply = totalSupply.div(4);
	const decimals = 18;

  beforeEach(async function () {
    this.inst = await DividendTokenBasic.new(totalSupply, decimals, {from: acc.owner});
  });

  describe('Basic cases', function() {
		it('should remember passed decimals', async function() {
			(await this.inst.decimals()).should.be.bignumber.equal(decimals);
		});
		it('should remember passed total supply', async function() {
			(await this.inst.totalSupply()).should.be.bignumber.equal(totalSupply);
		});
		it('should let the only tokenholder take all ether after investment', async function() {
			const investmentAmount = web3.toWei('50', 'finney');
      await this.inst.sendTransaction({from: acc.investor1, value: investmentAmount});
			const requestDividends = {func: this.inst.requestDividends, args: [], address: acc.owner};
			const expectedDiff = {[acc.owner]: investmentAmount, [acc.investor1]: 0};
			await assertBalanceDiff(requestDividends, expectedDiff);
		});

		it('Reproduce basic scenario', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				{call: 'transfer', from: 'owner', args: ['holder1', quarterSupply], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'requestDividends', from: 'owner', args: [], 
					etherDiff: {...zeroDiff, owner: web3.toWei('75', 'finney')}
				},
				{call: 'requestDividends', from: 'holder1', args: [], 
					etherDiff: {...zeroDiff, holder1: web3.toWei('25', 'finney')}
				},
				{call: 'putEther', from: 'investor2', args: [web3.toWei('100', 'finney')]},
				{call: 'transfer', from: 'owner', args: ['holder2', quarterSupply], 
					etherDiff: {...zeroDiff, 'owner': web3.toWei('75', 'finney')},
				},
				{call: 'requestDividends', from: 'holder1', args: [], 
					etherDiff: {...zeroDiff, holder1: web3.toWei('25', 'finney')}
				},
				{call: 'requestDividends', from: 'holder2', args: [], etherDiff: {...zeroDiff}},
			];
			await testCase.assertPlanWorks(plan);
		});
  });

  describe('Playing with dividend token', function() {
		it('mixed investments and transfers', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				{call: 'transfer', from: 'owner', args: ['holder1', quarterSupply], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'requestDividends', from: 'owner', args: [], 
					etherDiff: {...zeroDiff, owner: web3.toWei('75', 'finney')},
				},
				{call: 'transfer', from: 'owner', args: ['holder2', quarterSupply], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'transfer', from: 'owner', args: ['holder3', quarterSupply], 
					etherDiff: {...zeroDiff, owner: web3.toWei('50', 'finney')},
				},
				{call: 'requestDividends', from: 'owner', args: [], etherDiff: {...zeroDiff},},
				{call: 'requestDividends', from: 'holder1', args: [], 
					etherDiff: {...zeroDiff, holder1: web3.toWei('50', 'finney')},
				},
				{call: 'requestDividends', from: 'holder2', args: [], 
					etherDiff: {...zeroDiff, holder2: web3.toWei('25', 'finney')},
				},
				{call: 'requestDividends', from: 'holder3', args: [], etherDiff: {...zeroDiff},},
			];
			await testCase.assertPlanWorks(plan);
		});
		it('holder2 gets dividends as part of transfer', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				{call: 'transfer', from: 'owner', args: ['holder1', quarterSupply], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'requestDividends', from: 'owner', args: [], 
					etherDiff: {...zeroDiff, owner: web3.toWei('75', 'finney')},
				},
				{call: 'transfer', from: 'holder1', args: ['holder2', quarterSupply],
					etherDiff: {...zeroDiff, holder1: web3.toWei('25', 'finney')},
				},
			];
			await testCase.assertPlanWorks(plan);
		});
		it('holder1 and holder 2 gets dividends as part of transfer', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				{call: 'transfer', from: 'owner', args: ['holder1', halfSupply], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'transfer', from: 'owner', args: ['holder2', halfSupply], 
					etherDiff: {...zeroDiff, owner: web3.toWei('50', 'finney')}, 
				},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'transfer', from: 'holder1', args: ['holder2', quarterSupply],
					etherDiff: {...zeroDiff, 
						holder1: web3.toWei('100', 'finney'),
						holder2: web3.toWei('50', 'finney'),
					},
				},
			];
			await testCase.assertPlanWorks(plan);
		});
		it('odd amount of ether split beteen token holders - requestDividends', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				{call: 'transfer', from: 'owner', args: ['holder1', halfSupply], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('101', 'wei')]},
				{call: 'requestDividends', from: 'holder1', args: [],
					etherDiff: {...zeroDiff, holder1: web3.toWei('50', 'wei'),},
				},
				{call: 'requestDividends', from: 'holder2', args: [], etherDiff: {...zeroDiff},},
				{call: 'requestDividends', from: 'owner', args: [],
					etherDiff: {...zeroDiff, owner: web3.toWei('50', 'wei'), },
				},
			];
			await testCase.assertPlanWorks(plan);
		});
		it('odd amount of ether split beteen token holders - transfer', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				{call: 'transfer', from: 'owner', args: ['holder1', halfSupply], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('101', 'wei')]},
				{call: 'transfer', from: 'holder1', args: ['owner', quarterSupply],
					etherDiff: {...zeroDiff, 
						owner: web3.toWei('50', 'wei'),
						holder1: web3.toWei('50', 'wei'),
					},
				},
			];
			await testCase.assertPlanWorks(plan);
		});
		it('even amount of ether split in odd proportions', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};
			const totalSupply = web3.toWei('100', 'finney');
			const inst = await DividendTokenBasic.new(totalSupply, decimals, {from: acc.owner});

			const testCase = newTestCase(inst, acc);
			const plan = [
				{call: 'transfer', from: 'owner', args: ['holder1', web3.toWei('51', 'finney')], etherDiff: {...zeroDiff}},
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'wei')]},
				{call: 'transfer', from: 'holder1', args: ['owner', web3.toWei('25', 'finney')],
					etherDiff: {...zeroDiff, 
						holder1: web3.toWei('51', 'wei'),
						owner: web3.toWei('49', 'wei'),
					},
				},
			];
			await testCase.assertPlanWorks(plan);
		});
		it('transfer to self does not lead to double payment', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'transfer', from: 'owner', args: ['holder1', quarterSupply],
					etherDiff: {...zeroDiff, 
						owner: web3.toWei('100', 'finney'),
					},
				},
			];
			await testCase.assertPlanWorks(plan);
		});
  });

  describe.skip('pending tests', function() {
		it('ether sent to contract with no code executed', async function() {
			const zeroDiff = {owner: 0, holder1: 0, holder2: 0, investor1: 0, investor2: 0};

			const testCase = newTestCase(this.inst, acc);
			const plan = [
				//{call: 'putEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'forcedPutEther', from: 'investor1', args: [web3.toWei('100', 'finney')]},
				{call: 'requestDividends', from: 'owner', args: [], 
					etherDiff: {...zeroDiff, owner: web3.toWei('100', 'finney')},
				},
			];
			await testCase.assertPlanWorks(plan);
		});
  });


});
