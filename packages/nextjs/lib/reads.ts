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
  if (pool.lpToken.toLowerCase() !== lock.token.toLowerCase()) throw new Error("Lock token mismatch");
  const block = await rpc.getBlock("latest");
  if (!block) throw new Error("No latest block");
  return { id: id.toString(), depositor: lock.depositor, beneficiary: lock.beneficiary, pair: lock.pair, token: lock.token, amount: lock.amount.toString(), unlockAt: Number(lock.unlockAt), withdrawn: lock.withdrawn, decimals: pool.decimals, chainTime: block.timestamp, observedAt: new Date().toISOString() };
}
