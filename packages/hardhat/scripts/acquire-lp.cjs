const { send } = require("./budget.cjs");
const assert = require("node:assert/strict");
const hre = require("hardhat");
const { context, evidenceRun, associate, fail } = require("./helpers.cjs");

async function main() {
  const core = await context(hre);
  const rpc = hre.ethers.provider;
  const pair = await core.discoverPair(rpc);
  let pool = await core.readPool(pair, rpc);
  if (!pool.hasLiquidity) throw new Error("Canonical pool has no usable reserves. LP acquisition stopped; no mock fallback.");
  const native = await core.mirrorGet(`/tokens/${pool.lpTokenId}`);
  if (native.deleted || native.type !== "FUNGIBLE_COMMON") throw new Error("LP token is unavailable.");
  const budgetTinybars = core.amountUnits(process.env.LP_HBAR_BUDGET || "0.1", 8);
  if (budgetTinybars > 10000000n) throw new Error("LP_HBAR_BUDGET is capped at 0.1 testnet HBAR for each of swap and liquidity; fees are additional.");
  const budgetWei = budgetTinybars * 10000000000n;
  if (await rpc.getBalance(core.signer.address) < budgetWei * 2n + hre.ethers.parseEther("10")) throw new Error("Fund at least the swap/pool budget plus 10 testnet HBAR for fee headroom.");
  const router = new hre.ethers.Contract(core.TESTNET.router, core.ROUTER_ABI, core.signer);
  assert.equal((await router.factory()).toLowerCase(), core.TESTNET.factory.toLowerCase());
  const route = [core.TESTNET.whbar, core.TESTNET.sauce];
  const preliminaryQuote = await router.getAmountsOut(budgetTinybars, route);
  if (preliminaryQuote[1] * 99n / 100n === 0n) throw new Error("No usable quote. Stopped before any association or swap write.");
  console.log(`Proposed acquisition: associate SAUCE/LP if needed; swap at most ${hre.ethers.formatUnits(budgetTinybars, 8)} HBAR (quote ${preliminaryQuote[1]} SAUCE base units); exact router approval; pool at most the same HBAR amount; clear residual allowance. Fees additional; 1% slippage minima.`);
  const run = await evidenceRun("acquire-lp", { account: core.account.account, pool, maximumSwapHbar: hre.ethers.formatUnits(budgetTinybars, 8), maximumLiquidityHbar: hre.ethers.formatUnits(budgetTinybars, 8), feesAdditional: true });
  const sauce = await associate(core, hre, core.TESTNET.sauce, run, "associate SAUCE");
  const lp = await associate(core, hre, pool.lpToken, run, "associate LP token");
  const beforeLp = await lp.balanceOf(core.signer.address);
  const beforeSauce = await sauce.balanceOf(core.signer.address);
  const quote = await router.getAmountsOut(budgetTinybars, route);
  const minOut = quote[1] * 99n / 100n;
  if (minOut === 0n) throw new Error("Swap output is too small. No zero-slippage-minimum trade allowed.");
  const deadline = async () => (await rpc.getBlock("latest")).timestamp + 300;
  await send(hre, core, run, "swap HBAR for SAUCE", await router.swapExactETHForTokens.populateTransaction(minOut, route, core.signer.address, await deadline(), { value: budgetWei }));
  const acquiredSauce = await sauce.balanceOf(core.signer.address) - beforeSauce;
  if (acquiredSauce <= 0n) throw new Error("Swap did not increase the SAUCE balance.");
  pool = await core.readPool(pair, rpc);
  const whbarIs0 = pool.token0.toLowerCase() === core.TESTNET.whbar.toLowerCase();
  const reserveHbar = BigInt(whbarIs0 ? pool.reserve0 : pool.reserve1);
  const reserveSauce = BigInt(whbarIs0 ? pool.reserve1 : pool.reserve0);
  const hbarForAllSauce = acquiredSauce * reserveHbar / reserveSauce;
  const poolTinybars = hbarForAllSauce < budgetTinybars ? hbarForAllSauce : budgetTinybars;
  const desiredSauce = poolTinybars * reserveSauce / reserveHbar;
  if (poolTinybars < 100n || desiredSauce < 100n) throw new Error("Amounts too small for a nonzero bounded liquidity deposit.");
  await send(hre, core, run, "approve exact SAUCE for router", await sauce.approve.populateTransaction(core.TESTNET.router, desiredSauce, {}));
  assert.equal(await sauce.allowance(core.signer.address, core.TESTNET.router), desiredSauce);
  try {
    await send(hre, core, run, "mint real SaucerSwap LP", await router.addLiquidityETH.populateTransaction(core.TESTNET.sauce, desiredSauce, desiredSauce * 99n / 100n, poolTinybars * 99n / 100n, core.signer.address, await deadline(), { value: poolTinybars * 10000000000n }));
  } finally {
    // Also revoke after a reverted mint; acquisition evidence remains incomplete.
    if (await sauce.allowance(core.signer.address, core.TESTNET.router) > 0n) await send(hre, core, run, "clear residual router allowance", await sauce.approve.populateTransaction(core.TESTNET.router, 0n, {}));
  }
  const afterLp = await lp.balanceOf(core.signer.address);
  assert(afterLp > beforeLp, "No LP tokens were minted");
  run.data.lpMinted = (afterLp - beforeLp).toString();
  run.data.lpBalance = afterLp.toString();
  run.data.acquisitionVerified = true;
  await run.save();
  console.log(`Acquired ${run.data.lpMinted} LP base units. Evidence: ${run.file}. Lock workflow still requires testnet:proof.`);
}
main().catch(fail);
