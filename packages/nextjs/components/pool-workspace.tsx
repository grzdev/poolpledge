"use client";
import { useState } from "react";
import { Contract, formatUnits, type JsonRpcSigner } from "ethers";
import { amountUnits, readPool, TESTNET, TOKEN_ABI } from "@poolpledge/core";
import { useWallet, WalletNotice, TransactionStatus } from "./wallet";
import { useData } from "./use-data";
import { validateLock } from "../lib/rules.mjs";
import deployment from "../lib/deployment.json";
import abi from "../lib/PoolPledge.abi.json";
import type { PoolData } from "../lib/types";
import Link from "next/link";
export function AddressLink({ value, token = false }: { value: string; token?: boolean }) { return <a className="address" target="_blank" rel="noreferrer" href={`${TESTNET.explorer}/${token ? "token" : "contract"}/${value}`}>{value}<span aria-hidden> ↗</span></a>; }

export function PoolWorkspace() {
  const w = useWallet();
  const [pairInput, setPairInput] = useState("");
  const [pair, setPair] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const query = new URLSearchParams();
  if (pair) query.set("pair", pair);
  if (w.account) query.set("account", w.account);
  const { data: pool, error, loading, refresh } = useData<PoolData>(`/api/pool?${query}`, w.revision);
  let validation = "", units = 0n;
  if (pool && amount && date && pool.balance !== null) {
    try { units = validateLock(amount, pool.decimals, pool.balance, date, pool.chainTime).units; }
    catch (e) { validation = (e as Error).message; }
  }
  const accountMatches = pool?.account?.toLowerCase() === w.account.toLowerCase();
  const ready = Boolean(pool && accountMatches && w.account && w.chain === "0x128" && !w.busy && !loading && amount && date && !validation && units > 0n);
  const approved = units > 0n && pool?.allowance === units.toString();
  async function prepare(signer: JsonRpcSigner, deposit: boolean) {
    if (!pool) throw new Error("Refresh and validate the pool first.");
    const pledge = new Contract(deployment.address, abi, signer);
    if ((await pledge.factory()).toLowerCase() !== TESTNET.factory.toLowerCase()) throw new Error("Deployment factory mismatch.");
    const fresh = await readPool(pool.pair, signer);
    if (fresh.lpToken.toLowerCase() !== pool.lpToken.toLowerCase()) throw new Error("Pool token changed. Refresh and review again.");
    const token = new Contract(fresh.lpToken, TOKEN_ABI, signer);
    const owner = await signer.getAddress();
    const balance = await token.balanceOf(owner);
    const block = await signer.provider.getBlock("latest");
    if (!block) throw new Error("Latest network time is unavailable.");
    const valid = validateLock(amount, fresh.decimals, balance.toString(), date, block.timestamp);
    if (!deposit) return token.approve.populateTransaction(deployment.address, valid.units);
    if (await token.allowance(owner, deployment.address) !== valid.units) throw new Error("Approve this exact LP amount before depositing.");
    return pledge.createLock.populateTransaction(fresh.pair, valid.units, owner, valid.unlockAt);
  }
  return <><WalletNotice /><div className="workspace-grid"><section className="panel pool-panel"><div className="panel-heading"><span className="eyebrow">01 / DISCOVER</span><button className="text-button" disabled={loading || w.busy} onClick={refresh}>Refresh ↻</button></div><h2>Your liquidity, verified.</h2><p className="muted">Discover WHBAR / SAUCE or inspect a V1 pool address.</p><form className="pool-search" onSubmit={e => { e.preventDefault(); setPair(pairInput.trim()); refresh(); }}><label htmlFor="pair">Pool contract address <span className="muted">(optional)</span></label><div className="input-action"><input id="pair" value={pairInput} onChange={e => setPairInput(e.target.value)} placeholder="Default: WHBAR / SAUCE" disabled={w.busy} /><button className="secondary" disabled={w.busy || loading}>Discover</button></div></form>
      {loading && <div className="loading" role="status"><span className="pulse" /> Authenticating pool against the factory…</div>}
      {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={refresh}>Retry</button></div>}
      {pool && <><div className="pair-title"><div className="token-stack"><span>ℏ</span><span>S</span></div><div><h3>{pool.symbols.join(" / ")}</h3><span className="muted">SaucerSwap V1 · Hedera testnet</span></div><span className="badge good">Factory verified</span></div><div className="balance-box"><span>Your available LP</span><strong>{pool.balance === null ? "Connect wallet" : formatUnits(pool.balance, pool.decimals)} <small>{pool.balance === null ? "" : "LP"}</small></strong><span className="muted">{pool.balance === "0" ? "This wallet has no LP tokens. Add liquidity on SaucerSwap testnet before creating a lock." : "The LP token is a separate HTS asset from the pool contract."}</span></div><p className="pool-precision">LP precision: {pool.decimals} decimals · Native token {pool.lpTokenId}</p><p className="caption">Read from testnet · {new Date(pool.observedAt).toLocaleTimeString()}</p><details className="technical"><summary>Pool details & technical addresses</summary><dl className="facts"><div><dt>Pool contract</dt><dd><AddressLink value={pool.pair} /></dd></div>{[pool.token0, pool.token1].map((token, i) => <div key={token}><dt>{pool.symbols[i]} · {pool.underlyingDecimals[i]} decimals</dt><dd><AddressLink value={token} token /></dd></div>)}<div><dt>Native LP token</dt><dd><a href={`${TESTNET.explorer}/token/${pool.lpTokenId}`} target="_blank" rel="noreferrer">{pool.lpTokenId} ↗</a><small className="mono">{pool.lpToken}</small></dd></div><div><dt>LP precision</dt><dd>{pool.decimals} decimals</dd></div></dl></details></>}
    </section><section className="panel create-panel" id="create"><div className="panel-heading"><span className="eyebrow">02 / COMMIT</span><span className="badge">Fixed term</span></div><h2>Create a liquidity lock</h2><p className="muted">Choose an amount and a release time. Your connected wallet will be the withdrawal owner.</p><div className="steps"><span className={approved ? "done" : "active"}>1 <b>Approve exact amount</b></span><span className={approved ? "active" : ""}>2 <b>Deposit LP</b></span></div><label htmlFor="amount">LP amount</label><div className="input-action"><input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} disabled={w.busy} /><button type="button" className="text-button" disabled={w.busy || !pool?.balance || pool.balance === "0"} onClick={() => pool?.balance && setAmount(formatUnits(pool.balance, pool.decimals))}>Max</button></div><label htmlFor="unlock">Unlock date & time <span className="muted">(your local time)</span></label><input id="unlock" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} disabled={w.busy} /><p className="caption">At least one minute ahead. Up to five years. The release time cannot be shortened.</p><div className="review-box"><div><span>Withdrawal owner</span><strong className="mono">{w.account ? `${w.account.slice(0, 10)}…${w.account.slice(-6)}` : "Connect your wallet"}</strong></div><div><span>Approval scope</span><strong>{amount && pool ? (() => { try { return `${formatUnits(amountUnits(amount, pool.decimals), pool.decimals)} LP only`; } catch { return "Enter an amount"; } })() : "Exact amount only"}</strong></div><div><span>Network fees</span><strong>Estimated in wallet</strong></div></div>{validation && <p className="notice error" role="alert">{validation}</p>}
      {!w.account ? <button className="wide" onClick={() => void w.connect()}>Connect wallet to create a lock ↗</button> : <div className="action-grid"><button className="secondary" disabled={!ready || approved} onClick={() => void w.execute("Approve LP allowance", signer => prepare(signer, false))}>{approved ? "✓ Exact allowance ready" : "1. Approve LP"}</button><button disabled={!ready || !approved} onClick={() => void w.execute("Deposit LP", signer => prepare(signer, true))}>2. Create lock →</button></div>}
      <TransactionStatus actions={["Approve LP allowance", "Deposit LP", "Previously submitted transaction"]} /><p className="caption">Approval and deposit are separate transactions. Approval alone does not lock tokens.</p></section></div><div className="bottom-grid"><section className="note"><span className="eyebrow">TRANSPARENT BY DESIGN</span><h3>A commitment anyone can verify.</h3><p>No admin unlock. No upgrade proxy. Only the fixed owner can withdraw after the on-chain release time.</p></section><section className="note proof-note"><span className="eyebrow">EXECUTED ON TESTNET</span><h3>The first lock has come full circle.</h3><p>Increment 1 acquired real LP, deposited it, and withdrew after expiry.</p><Link href="/locks/0">Inspect verified lock #0 →</Link></section></div></>;
}
