require('babel-register')({
  ignore: /node_modules\/(?!openzeppelin-solidity\/test\/helpers)/
});
require('babel-polyfill');

// -------------------------------------------------------------------
// Emulate mocha --grep option to run only matching tests
let mochaConf = {}; // Passed as module.exports.mocha
// -------------------------------------------------------------------
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg != '-g' && arg != "--grep" ) continue;
  if (++i >= process.argv.length) {
    console.error(arg + " option requires argument");
    process.exit(1);
  };
  mochaConf.grep = new RegExp(process.argv[i]);
  break;
}
// -------------------------------------------------------------------

module.exports = {
  mocha: mochaConf,
  networks: {
    development: {
      host: "localhost",
      port: 9545,
      network_id: "*" // Match any network id
    },

    rinkeby: {  // testnet
      host: "localhost",
      port: 8547,
      network_id: 4
    },
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
