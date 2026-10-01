require("@nomicfoundation/hardhat-ethers");
const path = require("node:path");
require("dotenv").config({ path: [path.resolve(__dirname, "../../.env"), path.resolve(__dirname, "../../.env.local")], quiet: true });
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
// Keep malformed secret values out of Hardhat's configuration-error rendering.
// The live-script context reports a generic configuration error instead.
const configuredKey = process.env.DEPLOYER_PRIVATE_KEY || "";
const validKey = /^(0x)?[a-fA-F0-9]{64}$/.test(configuredKey);

// Use the lockfile-pinned npm compiler; no hidden solc download during build.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, _hre, runSuper) => {
  if (solcVersion !== "0.8.28") return runSuper();
  return { compilerPath: require.resolve("solc/soljson.js"), isSolcJs: true, version: solcVersion, longVersion: require("solc").version() };
});

module.exports = {
  solidity: { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" } },
  networks: {
    hardhat: { chainId: 31337 },
    hederaTestnet: {
      url: process.env.HEDERA_TESTNET_RPC_URL || "https://testnet.hashio.io/api",
      chainId: 296,
      gasPrice: process.env.POOLPLEDGE_GAS_PRICE_WEIBAR ? Number(process.env.POOLPLEDGE_GAS_PRICE_WEIBAR) : "auto",
      accounts: validKey ? [configuredKey] : [],
      timeout: 120000,
    },
  },
  mocha: { timeout: 30000 },
};
