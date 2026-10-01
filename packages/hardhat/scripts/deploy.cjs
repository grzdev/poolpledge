const hre = require("hardhat");
const { context, evidenceRun, deploy, fail } = require("./helpers.cjs");
async function main() {
  const core = await context(hre);
  const run = await evidenceRun("deploy", { account: core.account.account });
  await deploy(hre, core, run);
  console.log("Deployment only; fullWorkflowVerified remains false. Run npm run testnet:proof to prove custody and release.");
}
main().catch(fail);
