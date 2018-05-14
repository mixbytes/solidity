# solidity

![](https://api.travis-ci.org/mixbytes/solidity.svg?branch=master)

Generic solidity smart-contracts

Install deps:
```bash
npm install
```

Build and test:
```bash
# make sure ganache is running:
./node_modules/.bin/ganache-cli -u 0 -u 1 -u 2 -u 3 -u 4 -u 5 --port 9545 --gasPrice 2000 &>/tmp/ganache.log &

./node_modules/.bin/truffle compile && ./node_modules/.bin/truffle test
```
