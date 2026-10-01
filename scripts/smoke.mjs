import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
for (const path of ["/", "/locks/0", "/test-wallet"]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.match(await response.text(), /PoolPledge/);
  console.log(`PASS ${path}`);
}
for (const [path, status] of [["/api/pool?account=invalid", 400], ["/api/pool?pair=invalid", 400], ["/api/locks/invalid", 400], ["/api/locks/999999999999999", 404]]) {
  const response = await fetch(base + path);
  assert.equal(response.status, status, path);
  assert.equal(typeof (await response.json()).error, "string");
  console.log(`PASS ${path} → ${status}`);
}
const pool = await fetch(base + "/api/pool");
assert.equal(pool.status, 200);
const p = await pool.json();
assert.equal(p.lpTokenId, "0.0.2656383");
assert.equal(p.balance, null);
assert.notEqual(p.lpToken.toLowerCase(), p.pair.toLowerCase());
const lock = await fetch(base + "/api/locks/0");
assert.equal(lock.status, 200);
const l = await lock.json();
assert.equal(l.withdrawn, true);
assert.equal(l.amount, "71694");
assert.equal(l.token.toLowerCase(), p.lpToken.toLowerCase());
const accountPool = await fetch(`${base}/api/pool?account=${encodeURIComponent(l.beneficiary)}`);
assert.equal(accountPool.status, 200);
const owned = await accountPool.json();
assert.equal(owned.account.toLowerCase(), l.beneficiary.toLowerCase());
assert.match(owned.balance, /^\d+$/);
assert.match(owned.allowance, /^\d+$/);
console.log("PASS live factory discovery and Increment 1 lock evidence (read-only)");
