import test from "node:test";
import assert from "node:assert/strict";
import { amountUnits, nativeId, lockId, address, mirrorGet, TESTNET, readPool, FACTORY_ABI, PAIR_ABI, TOKEN_ABI } from "../src/index.mjs";
import { Interface, ZeroAddress } from "ethers";

test("token amounts remain exact beyond Number.MAX_SAFE_INTEGER", () => {
  assert.equal(amountUnits("90071992.54740993", 8), 9007199254740993n);
  for (const value of ["0", "-1", "1e3", "01", "0.000000001", "92233720369"]) assert.throws(() => amountUnits(value, 8));
});
test("native token identity rejects EVM aliases and zero", () => {
  assert.equal(nativeId(TESTNET.whbar), "0.0.15058");
  assert.throws(() => nativeId("0x1234567890123456789012345678901234567890"));
  assert.throws(() => address(ZeroAddress));
});
test("lock IDs reject coercion and path injection", () => {
  assert.equal(lockId("0"), 0n);
  for (const id of ["-1", "1e2", "../1", "01", "", "9".repeat(21)]) assert.throws(() => lockId(id));
});
test("upstream failures never masquerade as successful empty results", async () => {
  await assert.rejects(mirrorGet("/tokens/0.0.1", async () => ({ ok: false, status: 429 })), /429/);
});
test("pool reader checks factory membership, not just claimed factory", async () => {
  const iface = new Interface([...FACTORY_ABI, ...PAIR_ABI, ...TOKEN_ABI]);
  const pair = "0x000000000000000000000000000000000000beef";
  const runner = { call: async ({ data }) => {
    const parsed = iface.parseTransaction({ data });
    const values = { factory: [TESTNET.factory], token0: [TESTNET.whbar], token1: [TESTNET.sauce], lpToken: ["0x0000000000000000000000000000000000001234"], getReserves: [1, 1, 0], getPair: [ZeroAddress] };
    return iface.encodeFunctionResult(parsed.name, values[parsed.name]);
  } };
  await assert.rejects(readPool(pair, runner), /does not authenticate/);
});
