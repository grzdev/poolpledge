import test from "node:test";
import assert from "node:assert/strict";
import { walletScope, savedTransaction, lockStatus, scanIds, legacyWalletName } from "../lib/session.mjs";
test("draft and transaction scopes isolate account, chain and deployment", () => {
  const scope = walletScope("0xABC", "0x128", "0xDEF");
  assert.equal(scope, walletScope("0xabc", "0x128", "0xdef"));
  for (const other of [walletScope("0xabc", "0x1", "0xdef"), walletScope("0xabc", "0x128", "0xaaa"), walletScope("0xbbb", "0x128", "0xdef")]) assert.notEqual(scope, other);
});
test("saved transactions restore references only, never local success or approval flags", () => {
  const hash = "0x" + "a".repeat(64);
  assert.deepEqual(savedTransaction(JSON.stringify({hash, label:"Deposit LP", stage:"confirmed", approved:true, lockId:"999"})), {hash, label:"Deposit LP"});
  for (const value of [null, "invalid", "{}", JSON.stringify({hash:"0x123"})]) assert.equal(savedTransaction(value), null);
  assert.equal(savedTransaction(JSON.stringify({hash,label:"untrusted"})).label, "Previously submitted transaction");
});
test("bounded lock enumeration preserves bigint precision and does not skip pages", () => {
  const first = scanIds(43n, null);
  assert.equal(first.ids.length,20); assert.equal(first.ids[0],42n); assert.equal(first.ids.at(-1),23n);
  const second=scanIds(43n,first.nextCursor);const third=scanIds(43n,second.nextCursor);
  assert.equal(new Set([...first.ids,...second.ids,...third.ids]).size,43);
  assert.equal(third.nextCursor,null); assert.deepEqual(scanIds(0n,null),{ids:[],nextCursor:null});
  assert.equal(scanIds(9007199254740995n,null).ids[0],9007199254740994n);
  assert.throws(()=>scanIds(3n,"4")); assert.throws(()=>scanIds(3n,"-1"));
});
test("list statuses use chain time and withdrawal state", () => {
  assert.equal(lockStatus({withdrawn:false,unlockAt:200},199),"Locked");
  assert.equal(lockStatus({withdrawn:false,unlockAt:200},200),"Ready to withdraw");
  assert.equal(lockStatus({withdrawn:true,unlockAt:200},199),"Withdrawn");
});
test("legacy OKX flags take precedence over a compatibility MetaMask flag", () => {
  assert.equal(legacyWalletName({isMetaMask:true,isOkxWallet:true}),"OKX Wallet");
  assert.equal(legacyWalletName({isMetaMask:true}),"MetaMask");
  assert.equal(legacyWalletName({}),"Injected EVM wallet");
});
test("refresh recovery always queries receipts and keeps absent/failed reads unresolved", async () => {
  const {reconcileReference}=await import("../lib/session.mjs");
  const raw=JSON.stringify({hash:"0x"+"b".repeat(64),stage:"confirmed",label:"Deposit LP"});
  let reads=0;
  for (const receipt of [null,{status:0},{status:1}]) {
    const value=await reconcileReference(raw,async hash=>{reads++;assert.equal(hash,"0x"+"b".repeat(64));return receipt;});
    assert.equal(value.receipt,receipt);
  }
  assert.equal(reads,3);
  await assert.rejects(reconcileReference(raw,async()=>{throw Error("RPC unavailable");}),/RPC/);
});
