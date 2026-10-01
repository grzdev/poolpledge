const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");

async function context(hre) {
  const core = await import("@poolpledge/core");
  if (hre.network.name !== "hederaTestnet") throw new Error("Live scripts require --network hederaTestnet.");
  await core.assertTestnet(hre.ethers.provider);
  if (!/^(0x)?[a-fA-F0-9]{64}$/.test(process.env.DEPLOYER_PRIVATE_KEY || "")) throw new Error("Configure a raw 32-byte testnet ECDSA key locally in root .env.");
  if (!/^0\.0\.[1-9]\d*$/.test(process.env.HEDERA_ACCOUNT_ID || "")) throw new Error("Configure HEDERA_ACCOUNT_ID locally in root .env.");
  const [signer] = await hre.ethers.getSigners();
  const account = await core.mirrorGet(`/accounts/${process.env.HEDERA_ACCOUNT_ID}`);
  assert.equal(account.evm_address?.toLowerCase(), signer.address.toLowerCase(), "Configured key does not match the account EVM alias.");
  if (account.deleted) throw new Error("Configured account is deleted.");
  return { ...core, signer, account };
}

async function evidenceRun(kind, extra = {}) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(root, "evidence", `${kind}-${stamp}.local.json`);
  const data = { kind, startedAt: new Date().toISOString(), network: "testnet", chainId: 296, fullWorkflowVerified: false, transactions: [], ...extra };
  async function save() {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
  }
  await save();
  return { data, save, file };
}

async function record(run, label, transaction, log = console.log) {
  const tx = await transaction;
  const item = { label, hash: tx.hash, status: "submitted", hashscanUrl: `https://hashscan.io/testnet/transaction/${tx.hash}`, mirrorUrl: `https://testnet.mirrornode.hedera.com/api/v1/contracts/results/${tx.hash}` };
  run.data.transactions.push(item);
  await run.save();
  log(`${label}: ${item.hashscanUrl}`);
  let receipt;
  try {
    receipt = await tx.wait(1, 120000);
  } catch (error) {
    item.status = error?.receipt?.status === 0 ? "REVERTED" : "UNCONFIRMED";
    await run.save();
    throw error;
  }
  if (receipt?.status !== 1) {
    item.status = receipt?.status === 0 ? "REVERTED" : "UNCONFIRMED";
    await run.save();
    throw new Error(`${label} did not produce a successful receipt.`);
  }
  item.status = "SUCCESS";
  item.blockNumber = receipt.blockNumber;
  item.gasUsed = receipt.gasUsed.toString();
  if (receipt.gasPrice != null) {
    item.gasPriceWeibar = receipt.gasPrice.toString();
    item.evmFeeWeibar = (receipt.gasUsed * receipt.gasPrice).toString();
  }
  await run.save();
  return receipt;
}

async function associate(core, hre, tokenAddress, run, label) {
  const token = new hre.ethers.Contract(tokenAddress, core.TOKEN_ABI, core.signer);
  if (!(await token.isAssociated())) {
    const code = await token.associate.staticCall();
    if (code !== 22n && code !== 194n) throw new Error(`${label}: HTS association preflight returned ${code}`);
    await require("./budget.cjs").send(hre, core, run, label, await token.associate.populateTransaction());
    assert.equal(await token.isAssociated(), true, `${label}: association not established`);
  }
  return token;
}

async function deploy(hre, core, run) {
  const factory = await hre.ethers.getContractFactory("PoolPledge", core.signer);
  const receipt = await require("./budget.cjs").send(hre, core, run, "deploy PoolPledge", await factory.getDeployTransaction(core.TESTNET.factory));
  const contractAddress = receipt.contractAddress;
  const contract = await hre.ethers.getContractAt("PoolPledge", contractAddress, core.signer);
  run.data.contract = contractAddress;
  await run.save();
  const artifact = await hre.artifacts.readArtifact("PoolPledge");
  await fs.mkdir(path.join(root, "deployments"), { recursive: true });
  await fs.writeFile(path.join(root, "deployments/296.json"), JSON.stringify({ chainId: 296, address: contractAddress, factory: core.TESTNET.factory, abi: artifact.abi, deploymentTransaction: receipt.hash }, null, 2) + "\n");
  return contract;
}

function fail(error) {
  // Never print complete ethers errors: they may embed URLs or signed request bodies.
  const safeCodes = ["CALL_EXCEPTION", "INSUFFICIENT_FUNDS", "TIMEOUT", "NETWORK_ERROR", "SERVER_ERROR"];
  const text = String(error?.message || "Operation failed.")
    .replace(/(?:0x)?[a-fA-F0-9]{64,}/g, "[redacted hex]")
    .replace(/https?:\/\/\S+/g, "[redacted URL]");
  console.error(safeCodes.includes(error?.code) ? `Stopped: ${error.code}. Inspect the recorded transaction URL and account funding; no workflow pass is claimed.` : text.slice(0, 300));
  process.exitCode = 1;
}
module.exports = { root, context, evidenceRun, record, associate, deploy, fail };
