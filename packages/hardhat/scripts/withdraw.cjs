const assert = require("node:assert/strict");
const hre = require("hardhat");
const { context, evidenceRun, fail } = require("./helpers.cjs");

async function main() {
  const core = await context(hre);
  const contractAddress = core.address(process.env.POOLPLEDGE_ADDRESS);
  const id = core.lockId(process.env.PROOF_LOCK_ID);
  const pledge = await hre.ethers.getContractAt("PoolPledge", contractAddress, core.signer);
  assert.equal((await pledge.factory()).toLowerCase(), core.TESTNET.factory.toLowerCase());
  if (id >= await pledge.nextLockId()) throw new Error("No such lock in this deployment.");
  const lock = await pledge.locks(id);
  if (lock.beneficiary.toLowerCase() !== core.signer.address.toLowerCase()) throw new Error("Configured account is not this lock's beneficiary.");
  if (lock.withdrawn) throw new Error("Lock has already been withdrawn. No transaction needed.");
  if (BigInt((await hre.ethers.provider.getBlock("latest")).timestamp) < lock.unlockAt) throw new Error("Lock has not matured yet.");
  const lp = new hre.ethers.Contract(lock.token, core.TOKEN_ABI, core.signer);
  const before = await lp.balanceOf(core.signer.address);
  const run = await evidenceRun("withdraw-recovery", { contract: contractAddress, lockId: id.toString(), account: core.account.account, amount: lock.amount.toString() });
  await require("./budget.cjs").send(hre, core, run, "withdraw matured LP", await pledge.withdraw.populateTransaction(id));
  assert.equal(await lp.balanceOf(core.signer.address), before + lock.amount);
  assert.equal((await pledge.locks(id)).withdrawn, true);
  run.data.withdrawalVerified = true;
  await run.save();
  console.log(`Withdrawal verified: ${run.file}. This recovery record alone does not certify the earlier deposit.`);
}
main().catch(fail);
