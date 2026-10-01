// Repository-maintained checks, NOT an organizer eligibility certification.
import assert from "node:assert/strict";
import fs from "node:fs";
const read = path => JSON.parse(fs.readFileSync(path, "utf8"));
for (const file of ["README.md", "AGENTS.md", "LICENSE", ".env.example", "packages/nextjs/.env.example", "docs/ARCHITECTURE.md", "evidence/increment-1.public.json", "package-lock.json"]) {
  assert.ok(fs.statSync(file).size > 0, file);
}
const pkg = read("package.json");
assert.equal(pkg.license, "MIT");
assert.deepEqual(pkg.workspaces, ["packages/core", "packages/hardhat", "packages/nextjs"]);
for (const command of ["lint", "typecheck", "test", "build", "smoke"]) assert.ok(pkg.scripts[command], command);
if (fs.existsSync("template.json")) {
  const manifest = read("template.json");
  assert.ok(manifest.name);
  const block = manifest["create-scaffold-hbar"];
  assert.deepEqual(block.defaults, { frontend: "nextjs-app", solidityFramework: "hardhat", packageManager: "npm" });
  for (const [name, value] of Object.entries(block.defaults)) assert.deepEqual(block.capabilities[name], [value]);
  assert.equal(block.requirements.node, pkg.engines.node);
} else {
  assert.ok(process.argv.includes("--scaffolded"), "Source template.json missing; use --scaffolded only for CLI-generated projects");
  console.log("INFO scaffolded mode: CLI consumes template.json; source manifest check skipped");
}
const evidence = read("evidence/increment-1.public.json");
assert.equal(evidence.fullWorkflowVerified, true);
for (const label of ["deploy PoolPledge", "deposit LP into timed escrow", "withdraw matured LP"]) {
  const tx = evidence.transactions.find(tx => tx.label === label);
  assert.equal(tx?.status, "SUCCESS", label);
  assert.match(tx.hashscanUrl, /^https:\/\/hashscan.io\/testnet\/transaction\/0x[\da-f]{64}$/i);
}
const deployment = read("packages/nextjs/lib/deployment.json");
assert.equal(deployment.chainId, 296);
assert.equal(deployment.factory.toLowerCase(), evidence.pool.factory.toLowerCase());
console.log("PASS local packaging assertions. Public installation, live receipts, wallet signing and organizer eligibility are separate gates.");
