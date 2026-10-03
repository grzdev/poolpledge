import test from "node:test";
import assert from "node:assert/strict";
import { validateLock, withdrawalState, requireWallet, walletError } from "../lib/rules.mjs";
const now = 1790750000;
const date = new Date((now + 3600) * 1000).toISOString();
test("lock inputs preserve bigint precision and enforce available balance", () => {
  assert.equal(validateLock("90071992.54740993", 8, "9007199254740993", date, now).units, 9007199254740993n);
  for (const amount of ["0", "-1", "1e3", "0.000000001", "2"]) assert.throws(() => validateLock(amount, 8, "100000000", date, now));
});
test("unlock time rejects invalid, expired, near-expiry, and overlong locks", () => {
  for (const value of ["", "invalid", new Date(now * 1000).toISOString(), new Date((now + 60) * 1000).toISOString(), new Date((now + 5 * 365 * 86400 + 1) * 1000).toISOString()]) assert.throws(() => validateLock("1", 8, "100000000", value, now));
});
test("withdrawal eligibility includes owner, network, maturity, and spent state", () => {
  const lock = { beneficiary: "0xAbC", unlockAt: now, withdrawn: false };
  assert.equal(withdrawalState(lock, "0xabc", "0x128", now), "Ready to withdraw");
  assert.equal(withdrawalState(lock, "0xabc", "0x128", now - 1), "Locked until expiry");
  assert.equal(withdrawalState(lock, "", "", now), "Connect the owner wallet");
  assert.equal(withdrawalState(lock, "0xabc", "0x1", now), "Switch to Hedera testnet");
  assert.equal(withdrawalState(lock, "0xdef", "0x128", now), "Only the owner can withdraw");
  assert.equal(withdrawalState({ ...lock, withdrawn: true }, "0xabc", "0x128", now), "Withdrawn");
});
test("pre-sign check rejects chain changes and account changes", async () => {
  let chain = "0x128", accounts = ["0xabc"];
  const injected = { request: async ({ method }) => method === "eth_chainId" ? chain : accounts };
  await requireWallet(injected, "0xAbC");
  chain = "0x1";
  await assert.rejects(requireWallet(injected, "0xabc"), /296/);
  chain = "0x128"; accounts = ["0xdef"];
  await assert.rejects(requireWallet(injected, "0xabc"), /changed/);
  accounts = [];
  await assert.rejects(requireWallet(injected, "0xabc"), /changed/);
  await assert.rejects(requireWallet(undefined, "0xabc"), /Install/);
});
test("wallet errors distinguish rejected signatures, insufficient gas funds, and uncertain confirmation", () => {
  assert.match(walletError({ code: 4001 }), /declined/);
  assert.doesNotMatch(walletError({ code: 4001 }), /approval|allowance|remains/i);
  assert.doesNotMatch(walletError({ code: "ACTION_REJECTED" }), /approval|allowance|remains/i);
  assert.match(walletError({ code: "INSUFFICIENT_FUNDS" }), /HBAR/);
  assert.match(walletError({ code: "TIMEOUT" }), /may still confirm/);
  assert.match(walletError({ code: -32002 }), /already open/);
  assert.doesNotMatch(walletError(new Error("RPC https://example.com/private?key=secret")), /secret/);
});

test("approval does not require a date; every unavailable prerequisite explains itself", async () => {
  const { lockActionReasons } = await import("../lib/rules.mjs");
  const ready = { account: "0xabc", chain: "0x128", busy: false, stage: "idle", loading: false, error: "", pool: { balance: "7169477", allowance: "0" }, accountMatches: true, amount: "0.00071694", amountError: "", approved: false, date: "", validation: "" };
  assert.equal(lockActionReasons(ready).approvalReason, "");
  assert.match(lockActionReasons(ready).depositReason, /unlock/);
  for (const [patch, pattern] of [
    [{account:""}, /Connect/], [{chain:"0x1"}, /296/],
    [{busy:true,stage:"pending"}, /pending/], [{busy:true,stage:"signature"}, /wallet request/],
    [{loading:true}, /Loading/], [{error:"RPC failed"}, /Retry/], [{pool:null}, /Discover/],
    [{accountMatches:false}, /another wallet/], [{pool:{balance:null,allowance:"0"}}, /balance/],
    [{pool:{balance:"1",allowance:null}}, /allowance/], [{amount:""}, /amount/],
    [{amountError:"LP amount exceeds your available balance."}, /exceeds/], [{approved:true}, /already confirmed/]
  ]) assert.match(lockActionReasons({...ready,...patch}).approvalReason, pattern);
  assert.match(lockActionReasons({...ready,date,validation:"Choose an unlock time more than one minute ahead."}).depositReason, /minute/);
  assert.equal(lockActionReasons({...ready,date,approved:true}).depositReason, "");
});
