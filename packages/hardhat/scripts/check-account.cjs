const hre = require("hardhat");
const { context, fail } = require("./helpers.cjs");
async function main() {
  const core = await context(hre);
  const pair = process.env.PROOF_PAIR_ADDRESS || await core.discoverPair(hre.ethers.provider);
  const pool = await core.readPool(pair, hre.ethers.provider);
  const lp = new hre.ethers.Contract(pool.lpToken, core.TOKEN_ABI, core.signer);
  const gasPrice = (await hre.ethers.provider.getFeeData()).gasPrice;
  console.log(JSON.stringify({ accountKeyMatch: true, hbar: hre.ethers.formatEther(await hre.ethers.provider.getBalance(core.signer.address)), gasPriceWeibar: gasPrice?.toString() ?? null, pool, lpBalanceBaseUnits: (await lp.balanceOf(core.signer.address)).toString(), lpAssociated: await lp.isAssociated() }, null, 2));
}
main().catch(fail);
