const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const hre = require("hardhat");
const { root, context, fail } = require("./helpers.cjs");
const { send } = require("./budget.cjs");
const { isContractRevert } = require("./revert.cjs");
async function main() {
  const core = await context(hre);
  const files = (await fs.readdir(path.join(root, "evidence"))).filter(n => n.startsWith("lock-cycle-") && n.endsWith(".local.json")).sort();
  if (!files.length) throw new Error("No saved lock cycle");
  const file = path.join(root, "evidence", files.at(-1));
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  const run = { data, file, save: () => fs.writeFile(file, JSON.stringify(data, null, 2) + "\n") };
  const pledge = await hre.ethers.getContractAt("PoolPledge", data.contract, core.signer);
  assert.equal((await pledge.factory()).toLowerCase(), core.TESTNET.factory.toLowerCase());
  const pool = await core.readPool(data.pool.pair, hre.ethers.provider);
  assert.equal(pool.lpToken.toLowerCase(), data.pool.lpToken.toLowerCase());
  const lp = new hre.ethers.Contract(pool.lpToken, core.TOKEN_ABI, core.signer);
  const id = BigInt(data.lockId);
  const lock = await pledge.locks(id);
  assert.equal(lock.beneficiary.toLowerCase(), core.signer.address.toLowerCase());
  assert.equal(lock.amount, BigInt(data.amount));
  const deposit = data.transactions.find(tx => tx.label === "deposit LP into timed escrow");
  assert.equal((await hre.ethers.provider.getTransactionReceipt(deposit.hash)).status, 1);
  if (!data.earlyWithdrawalRejected) {
    const block = await hre.ethers.provider.getBlock(deposit.blockNumber);
    assert(block.timestamp < Number(lock.unlockAt));
    await assert.rejects(pledge.withdraw.staticCall(id, { blockTag: deposit.blockNumber }), isContractRevert);
    data.earlyWithdrawalRejected = true;
    data.earlyWithdrawalCheck = { blockNumber: deposit.blockNumber, timestamp: block.timestamp, historicalCall: true, customErrorNameDecoded: false };
    await run.save();
  }
  if (!lock.withdrawn) {
    assert.equal(await lp.balanceOf(core.signer.address), BigInt(data.beforeBalance) - lock.amount);
    assert.equal(await lp.allowance(core.signer.address, data.contract), 0n);
    assert.equal(await lp.balanceOf(data.contract), lock.amount);
    assert.equal(await pledge.totalLocked(pool.lpToken), lock.amount);
    while ((await hre.ethers.provider.getBlock("latest")).timestamp < Number(lock.unlockAt)) {
      console.log("Existing lock verified; waiting for maturity.");
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    await send(hre, core, run, "withdraw matured LP", await pledge.withdraw.populateTransaction(id));
  }
  assert.equal(await lp.balanceOf(core.signer.address), BigInt(data.beforeBalance));
  assert.equal(await lp.balanceOf(data.contract), 0n);
  assert.equal(await pledge.totalLocked(pool.lpToken), 0n);
  assert.equal((await pledge.locks(id)).withdrawn, true);
  await assert.rejects(pledge.withdraw.staticCall(id), isContractRevert);
  data.repeatedWithdrawalRejected = true;
  data.afterBalance = (await lp.balanceOf(core.signer.address)).toString();
  data.fullWorkflowVerified = true;
  data.completedAt = new Date().toISOString();
  await run.save();
  await fs.writeFile(path.join(root, "deployments/latest-proof.json"), JSON.stringify(data, null, 2) + "\n");
  console.log(`Existing lock cycle verified: ${file}`);
}
main().catch(fail);
