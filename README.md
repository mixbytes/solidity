# solidity
Generic solidity smart-contracts

Install deps:
```bash
npm install
```

Build and test:
```bash
# make sure testrpc is running:
testrpc -u 0 -u 1 -u 2 -u 3 -u 4 -u 5 --gasPrice 2000 &

truffle compile && truffle test
```
