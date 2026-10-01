const assert = require("node:assert/strict");
const { record } = require("../scripts/helpers.cjs");
const { checkBudget } = require("../scripts/budget.cjs");
const { isContractRevert } = require("../scripts/revert.cjs");

describe("Increment 1 transaction evidence", function () {
  it("accepts relay execution reverts but rejects network failures", function () {
    assert.equal(isContractRevert(new Error("execution reverted: CONTRACT_REVERT_EXECUTED")), true);
    assert.equal(isContractRevert({ code: "NETWORK_ERROR", message: "network unavailable" }), false);
    assert.equal(isContractRevert({ code: "TIMEOUT", message: "request timeout" }), false);
  });
  it("counts prior failed fees and keeps withdrawal headroom within the exact budget", function () {
    const spentAndPrincipal = 32828158n + 20000000n;
    assert.doesNotThrow(() => checkBudget(spentAndPrincipal, 585471842n, 60000000n));
    assert.throws(() => checkBudget(spentAndPrincipal, 585471843n, 60000000n), /Budget stop/);
    assert.throws(() => checkBudget(698300000n, 1n, 0n), /Budget stop/);
  });
  function run() {
    return { data: { fullWorkflowVerified: false, transactions: [] }, save: async () => {} };
  }
  // Explicit fixture hash: never submitted to a network or exported as live evidence.
  const fixtureHash = "0x" + "0".repeat(64);
  it("does not mark a reverted transaction or workflow successful", async function () {
    const evidence = run();
    await assert.rejects(record(evidence, "test fixture revert", Promise.resolve({ hash: fixtureHash, wait: async () => ({ status: 0 }) }), () => {}), /successful receipt/);
    assert.equal(evidence.data.transactions[0].status, "REVERTED");
    assert.equal(evidence.data.fullWorkflowVerified, false);
  });
  it("preserves an unconfirmed hash when receipt polling times out", async function () {
    const evidence = run();
    await assert.rejects(record(evidence, "test fixture timeout", Promise.resolve({ hash: fixtureHash, wait: async () => { throw new Error("timeout"); } }), () => {}), /timeout/);
    assert.equal(evidence.data.transactions[0].status, "UNCONFIRMED");
    assert.equal(evidence.data.transactions[0].hash, fixtureHash);
    assert.equal(evidence.data.fullWorkflowVerified, false);
  });
  it("records a successful receipt without upgrading it to workflow proof", async function () {
    const evidence = run();
    await record(evidence, "test fixture receipt", Promise.resolve({ hash: fixtureHash, wait: async () => ({ status: 1, blockNumber: 1, gasUsed: 21000n }) }), () => {});
    assert.equal(evidence.data.transactions[0].status, "SUCCESS");
    assert.equal(evidence.data.fullWorkflowVerified, false);
  });
});
