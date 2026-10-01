const fs = require("node:fs/promises");
const path = require("node:path");
const { root, record } = require("./helpers.cjs");
const CAP = 698300000n;
// Runtime eth_estimateGas is supported by Hedera:
// https://hedera.com/blog/estimate-gas-dynamically/ (read 2026-09-30).
function checkBudget(used, feeCeiling, reserve) {
  if (used < 0n || feeCeiling < 0n || reserve < 0n || used + feeCeiling + reserve > CAP) throw new Error(`Budget stop: ${used} tinybar spent/reserved principal; next fee ceiling ${feeCeiling}; withdrawal reserve ${reserve}; cap ${CAP}. No transaction submitted.`);
}
// Count the full original network fee, not just the signer contribution.
// Reserve the full 0.2 HBAR principal throughout, even if liquidity refunds dust.
async function spent() {
  const seen = new Set();
  let total = 20000000n;
  for (const name of await fs.readdir(path.join(root, "evidence"))) {
    if (!name.endsWith(".local.json")) continue;
    const data = JSON.parse(await fs.readFile(path.join(root, "evidence", name), "utf8"));
    for (const tx of data.transactions || []) {
      if (seen.has(tx.hash)) continue;
      if (tx.chargedTxFeeTinybar == null) throw new Error("Reconcile outstanding transaction fee before another write.");
      seen.add(tx.hash);
      total += BigInt(tx.chargedTxFeeTinybar);
    }
  }
  return total;
}
async function settle(core, run, item) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const result = await core.mirrorGet(`/contracts/results/${item.hash}`);
      const native = await core.mirrorGet(`/transactions?timestamp=${result.timestamp}`);
      if (!native.transactions?.length) throw new Error("Mirror fee pending");
      item.chargedTxFeeTinybar = native.transactions.reduce((sum, tx) => sum + BigInt(tx.charged_tx_fee), 0n).toString();
      item.result = result.result;
      item.consensusTimestamp = result.timestamp;
      item.nativeMirrorUrl = `${core.TESTNET.mirror}/transactions?timestamp=${result.timestamp}`;
      item.transfers = native.transactions.flatMap(tx => tx.transfers);
      await run.save();
      return;
    } catch {
      if (attempt === 11) throw new Error("Fee reconciliation pending; stop before another write.");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
async function send(hre, core, run, label, request) {
  const estimate = await core.signer.estimateGas(request);
  const gasLimit = (estimate * 110n + 99n) / 100n;
  const gasPrice = (await hre.ethers.provider.getFeeData()).gasPrice;
  if (!gasPrice) throw new Error("No fee quote");
  const feeCeiling = (gasLimit * gasPrice + 9999999999n) / 10000000000n + 1000000n;
  const used = await spent();
  const reserve = label === "withdraw matured LP" ? 0n : 60000000n;
  checkBudget(used, feeCeiling, reserve);
  run.data.nextSubmission = { label, estimatedGas: estimate.toString(), gasLimit: gasLimit.toString(), gasPriceWeibar: gasPrice.toString(), feeCeilingTinybar: feeCeiling.toString(), cumulativeCeilingTinybar: (used + feeCeiling).toString() };
  await run.save();
  console.log(`${label}: RPC estimate ${estimate}, limit ${gasLimit}, fee ceiling ${hre.ethers.formatUnits(feeCeiling, 8)} HBAR; cumulative ceiling including principal ${hre.ethers.formatUnits(used + feeCeiling, 8)} HBAR.`);
  let receipt;
  try {
    receipt = await record(run, label, core.signer.sendTransaction({ ...request, gasLimit, gasPrice }));
  } finally {
    const item = run.data.transactions.at(-1);
    if (item?.label === label) await settle(core, run, item);
  }
  return receipt;
}
module.exports = { send, spent, checkBudget };
