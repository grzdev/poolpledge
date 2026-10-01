const hre = require("hardhat");
const fs = require("node:fs/promises");
const path = require("node:path");
const { root, context, evidenceRun, fail } = require("./helpers.cjs");

async function main() {
  const core = await context(hre);
  const run = await evidenceRun("reconciliation");
  let charged = 0n;
  let principal = 0n;
  const seen = new Set();
  for (const name of await fs.readdir(path.join(root, "evidence"))) {
    if (!name.endsWith(".local.json")) continue;
    const file = path.join(root, "evidence", name);
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    for (const tx of data.transactions || []) {
      if (seen.has(tx.hash)) continue;
      seen.add(tx.hash);
      const result = await core.mirrorGet(`/contracts/results/${tx.hash}`);
      const native = await core.mirrorGet(`/transactions?timestamp=${result.timestamp}`);
      const records = native.transactions;
      if (!records?.length) throw new Error("Missing native fee evidence.");
      const fee = records.reduce((sum, r) => sum + BigInt(r.charged_tx_fee), 0n);
      charged += fee;
      principal += BigInt(result.amount);
      Object.assign(tx, { result: result.result, gasLimit: result.gas_limit, gasUsed: result.gas_used, chargedTxFeeTinybar: fee.toString(), consensusTimestamp: result.timestamp, nativeMirrorUrl: `${core.TESTNET.mirror}/transactions?timestamp=${result.timestamp}`, transfers: records.flatMap(r => r.transfers) });
      run.data.transactions.push(tx);
    }
    await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
  }
  const pool = await core.readPool(await core.discoverPair(hre.ethers.provider), hre.ethers.provider);
  const tokens = {};
  for (const [name, address] of Object.entries({ sauce: core.TESTNET.sauce, lp: pool.lpToken, whbar: core.TESTNET.whbar })) {
    const token = new hre.ethers.Contract(address, core.TOKEN_ABI, core.signer);
    const associated = await token.isAssociated();
    tokens[name] = { address, associated, balance: (await token.balanceOf(core.signer.address)).toString(), routerAllowance: (await token.allowance(core.signer.address, core.TESTNET.router)).toString() };
    if (!associated) tokens[name].associationEstimatedGas = (await token.associate.estimateGas()).toString();
  }
  const factory = await hre.ethers.getContractFactory("PoolPledge", core.signer);
  const deployGas = await core.signer.estimateGas(await factory.getDeployTransaction(core.TESTNET.factory));
  Object.assign(run.data, { accountKeyMatch: true, pool, tokens, deploymentEstimatedGas: deployGas.toString(), gasPriceWeibar: (await hre.ethers.provider.getFeeData()).gasPrice.toString(), hbar: hre.ethers.formatEther(await hre.ethers.provider.getBalance(core.signer.address)), chargedFeeTinybar: charged.toString(), grossPrincipalTinybar: principal.toString(), cumulativeFeeAndGrossPrincipalTinybar: (charged + principal).toString(), budgetTinybar: "698300000", remainingTinybar: (698300000n - charged - principal).toString() });
  try {
    const proof = JSON.parse(await fs.readFile(path.join(root, "deployments/latest-proof.json"), "utf8"));
    const pledge = await hre.ethers.getContractAt("PoolPledge", proof.contract, core.signer);
    const token = new hre.ethers.Contract(pool.lpToken, core.TOKEN_ABI, core.signer);
    const lock = await pledge.locks(BigInt(proof.lockId));
    run.data.lockState = { contract: proof.contract, lockId: proof.lockId, withdrawn: lock.withdrawn, amount: lock.amount.toString(), escrowBalance: (await token.balanceOf(proof.contract)).toString(), totalLocked: (await pledge.totalLocked(pool.lpToken)).toString(), remainingAllowance: (await token.allowance(core.signer.address, proof.contract)).toString(), fullWorkflowVerified: proof.fullWorkflowVerified };
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  await run.save();
  console.log(JSON.stringify(run.data, null, 2));
}
main().catch(fail);
