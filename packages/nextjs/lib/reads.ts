import { Contract, ZeroAddress } from "ethers";
import { TESTNET, provider, assertTestnet, readPool, discoverPair, TOKEN_ABI } from "@poolpledge/core";
import deployment from "./deployment.json";
import abi from "./PoolPledge.abi.json";
import type { PoolData, LockData } from "./types";
// Public RPC only. This module has no credential or environment-file access.
export const rpc = provider();
export async function checkedContract() {
  await assertTestnet(rpc);
  const pledge = new Contract(deployment.address, abi, rpc);
  if ((await pledge.factory()).toLowerCase() !== TESTNET.factory.toLowerCase()) throw new Error("Deployment factory mismatch");
  return pledge;
}
export async function getPool(pair?: string, account?: string): Promise<PoolData> {
  await checkedContract();
  const pool = await readPool(pair || await discoverPair(rpc), rpc);
  const lp = new Contract(pool.lpToken, TOKEN_ABI, rpc);
  const tokenMetadata = await Promise.all([pool.token0, pool.token1].map(async token => {
    const c = new Contract(token, ["function symbol() view returns(string)", "function decimals() view returns(uint8)"], rpc);
    return { symbol: String(await c.symbol()), decimals: Number(await c.decimals()) };
  }));
  const block = await rpc.getBlock("latest");
  if (!block) throw new Error("No latest block");
  const [balance, allowance] = account ? await Promise.all([lp.balanceOf(account), lp.allowance(account, deployment.address)]) : [null, null];
  return { ...pool, symbols: tokenMetadata.map(t => t.symbol), underlyingDecimals: tokenMetadata.map(t => t.decimals), balance: balance?.toString() ?? null, allowance: allowance?.toString() ?? null, account: account || null, chainTime: block.timestamp };
}
export async function getLock(id: bigint): Promise<LockData | null> {
  const pledge = await checkedContract();
  if (id >= await pledge.nextLockId()) return null;
  const lock = await pledge.locks(id);
  if (lock.depositor === ZeroAddress) return null;
  const pool = await readPool(lock.pair, rpc);
  const symbols = await Promise.all([pool.token0, pool.token1].map(token => new Contract(token, ["function symbol() view returns(string)"], rpc).symbol().then(String)));
  if (pool.lpToken.toLowerCase() !== lock.token.toLowerCase()) throw new Error("Lock token mismatch");
  const block = await rpc.getBlock("latest");
  if (!block) throw new Error("No latest block");
  return { symbols, id: id.toString(), depositor: lock.depositor, beneficiary: lock.beneficiary, pair: lock.pair, token: lock.token, amount: lock.amount.toString(), unlockAt: Number(lock.unlockAt), withdrawn: lock.withdrawn, decimals: pool.decimals, chainTime: block.timestamp, observedAt: new Date().toISOString() };
}

// Bounded on-chain enumeration: nextLockId + locks are existing public getters.
// No database or invented index. Each page scans at most 20 IDs, newest first.
export async function getWalletLocks(account: string, cursor: string | null) {
  const pledge = await checkedContract();
  const { scanIds } = await import("./session.mjs");
  const page = scanIds(BigInt(await pledge.nextLockId()), cursor);
  const found: bigint[] = [];
  for (let i = 0; i < page.ids.length; i += 5) {
    const ids = page.ids.slice(i, i + 5);
    const records = await Promise.all(ids.map(id => pledge.locks(id)));
    records.forEach((lock, index) => { if (lock.beneficiary.toLowerCase() === account.toLowerCase()) found.push(ids[index]); });
  }
  const locks = await Promise.all(found.map(id => getLock(id)));
  if (locks.some(lock => lock === null)) throw new Error("Lock disappeared while reading");
  return { locks, nextCursor: page.nextCursor, scanned: page.ids.length };
}
