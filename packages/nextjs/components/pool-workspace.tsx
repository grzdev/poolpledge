"use client";
import { useEffect, useState } from "react";
import { Contract, formatUnits, type JsonRpcSigner } from "ethers";
import { amountUnits, readPool, TESTNET, TOKEN_ABI } from "@poolpledge/core";
import { useWallet, WalletNotice, TransactionStatus } from "./wallet";
import { useData } from "./use-data";
import { validateLock, lockActionReasons } from "../lib/rules.mjs";
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
  const [draftScope, setDraftScope] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
    if (!active) return;
    let saved: {amount?: string; date?: string; pair?: string} = {};
    try { saved = JSON.parse(localStorage.getItem(w.scope + ":draft") || "{}"); } catch { /* Invalid draft is discarded. */ }
    setAmount(typeof saved?.amount === "string" ? saved.amount.slice(0, 100) : "");
    setDate(typeof saved?.date === "string" ? saved.date.slice(0, 30) : "");
    setPair(typeof saved?.pair === "string" ? saved.pair.slice(0, 42) : "");
    setPairInput(typeof saved?.pair === "string" ? saved.pair.slice(0, 42) : "");
    setDraftScope(w.scope);
    });
    return () => { active = false; };
  }, [w.scope]);
  useEffect(() => {
    if (!w.scope || draftScope !== w.scope) return;
    try { localStorage.setItem(w.scope + ":draft", JSON.stringify({amount, date, pair})); } catch { /* Draft persistence is optional, transaction persistence is not. */ }
  }, [w.scope, draftScope, amount, date, pair]);
  const query = new URLSearchParams();
  if (pair) query.set("pair", pair);
  if (w.account) query.set("account", w.account);
  const { data: pool, error, loading, refresh } = useData<PoolData>(`/api/pool?${query}`, w.revision);
  const [clock, setClock] = useState(0);
  useEffect(() => { const tick = () => setClock(Math.floor(Date.now() / 1000)); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, []);
  let validation = "", amountError = "", units = 0n;
  if (pool && amount && pool.balance !== null) {
    try { units = amountUnits(amount, pool.decimals); if (units > BigInt(pool.balance)) throw new Error("LP amount exceeds your available balance."); }
    catch (e) { amountError = (e as Error).message; }
  }
  if (pool && amount && date && pool.balance !== null) {
    try { units = validateLock(amount, pool.decimals, pool.balance, date, Math.max(pool.chainTime, clock)).units; }
    catch (e) { validation = (e as Error).message; }
  }
  const depositComplete = w.tx.stage === "confirmed" && w.tx.lockId !== undefined;
  const accountMatches = pool?.account?.toLowerCase() === w.account.toLowerCase();
  const approved = !amountError && units > 0n && pool?.allowance === units.toString();
  const { approvalReason, depositReason } = lockActionReasons({ account: w.account, chain: w.chain, busy: w.busy, stage: w.tx.stage, loading: loading || draftScope !== w.scope, error, pool, accountMatches, amount, amountError, approved, date, validation });
  const isDateExpired = Boolean(date && !Number.isNaN(Date.parse(date)) && Date.parse(date) <= (Math.max(pool?.chainTime || 0, clock) + 60) * 1000);
  function fiveMinutes() {
    const time = new Date((Math.max(pool?.chainTime || 0, Math.floor(Date.now() / 1000)) + 300) * 1000);
    const local = new Date(time.getTime() - time.getTimezoneOffset() * 60000);
    setDate(local.toISOString().slice(0, 19));
  }
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
    const approvalUnits = amountUnits(amount, fresh.decimals);
    if (approvalUnits > balance) throw new Error("LP amount exceeds your available balance.");
    if (!deposit) return token.approve.populateTransaction(deployment.address, approvalUnits);
    const valid = validateLock(amount, fresh.decimals, balance.toString(), date, block.timestamp);
    if (await token.allowance(owner, deployment.address) !== valid.units) throw new Error("Approve this exact LP amount before depositing.");
    return pledge.createLock.populateTransaction(fresh.pair, valid.units, owner, valid.unlockAt);
  }
  return <><WalletNotice /><div className="workspace-grid"><section className="panel pool-panel"><div className="panel-heading"><span className="eyebrow">01 / DISCOVER</span><button className="text-button" disabled={loading || w.busy} onClick={refresh}>Refresh ↻</button></div><h2>Your liquidity, verified.</h2><p className="muted">Discover WHBAR / SAUCE or inspect a V1 pool address.</p><form className="pool-search" onSubmit={e => { e.preventDefault(); setPair(pairInput.trim()); refresh(); }}><label htmlFor="pair">Pool contract address <span className="muted">(optional)</span></label><div className="input-action"><input id="pair" value={pairInput} onChange={e => setPairInput(e.target.value)} placeholder="Default: WHBAR / SAUCE" disabled={w.busy} /><button className="secondary" disabled={w.busy || loading}>Discover</button></div></form>
      {loading && !pool && <div className="loading" role="status"><span className="pulse" /> Authenticating pool against the factory…</div>}
      {error && <div className="notice error" role="alert">{w.tx.stage === "confirmed" ? "Transaction confirmed. Balance refresh failed; previous values may be stale. " : ""}{error}<button className="text-button" onClick={refresh}>Retry</button></div>}
      {pool && <><div className="pair-title"><div className="token-stack"><span>ℏ</span><span>S</span></div><div><h3>{pool.symbols.join(" / ")}</h3><span className="muted">SaucerSwap V1 · Hedera testnet</span></div><span className="badge good">Factory verified</span></div><div className="balance-box"><span>Your available LP</span><strong>{pool.balance === null ? "Connect wallet" : formatUnits(pool.balance, pool.decimals)} <small>{pool.balance === null ? "" : "LP"}</small></strong><span className="muted">{pool.balance === "0" ? "This wallet has no LP tokens. Add liquidity on SaucerSwap testnet before creating a lock." : "The LP token is a separate HTS asset from the pool contract."}</span></div><p className="pool-precision">LP precision: {pool.decimals} decimals · Native token {pool.lpTokenId}</p><p className="caption">Read from testnet · {new Date(pool.observedAt).toLocaleTimeString()}</p><details className="technical"><summary>Pool details & technical addresses</summary><dl className="facts"><div><dt>Pool contract</dt><dd><AddressLink value={pool.pair} /></dd></div>{[pool.token0, pool.token1].map((token, i) => <div key={token}><dt>{pool.symbols[i]} · {pool.underlyingDecimals[i]} decimals</dt><dd><AddressLink value={token} token /></dd></div>)}<div><dt>Native LP token</dt><dd><a href={`${TESTNET.explorer}/token/${pool.lpTokenId}`} target="_blank" rel="noreferrer">{pool.lpTokenId} ↗</a><small className="mono">{pool.lpToken}</small></dd></div><div><dt>LP precision</dt><dd>{pool.decimals} decimals</dd></div></dl></details></>}
    </section><section className="panel create-panel" id="create"><div className="panel-heading"><span className="eyebrow">02 / COMMIT</span><span className="badge">Fixed term</span></div><h2>Create a liquidity lock</h2><p className="muted">Choose an amount and a release time. Your connected wallet will be the withdrawal owner.</p>{!depositComplete && <><div className="steps"><span className={approved ? "done" : "active"}>1 <b>Approve exact amount</b></span><span className={approved ? "active" : ""}>2 <b>Deposit LP</b></span></div><label htmlFor="amount">LP amount</label><div className="input-action"><input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} disabled={w.busy} /><button type="button" className="text-button" disabled={w.busy || !pool?.balance || pool.balance === "0"} onClick={() => pool?.balance && setAmount(formatUnits(pool.balance, pool.decimals))}>Max</button></div><label htmlFor="unlock">Unlock date & time <span className="muted">(your local time)</span></label><input id="unlock" type="datetime-local" step="1" value={date} onChange={e => setDate(e.target.value)} disabled={w.busy} /><div className="inline" style={{marginTop:"6px"}}><button type="button" className="text-button" disabled={w.busy} onClick={fiveMinutes}>Five minutes from now</button>{date && <button type="button" className="text-button" disabled={w.busy} onClick={() => setDate("")}>Reset date</button>}</div>{isDateExpired && <p className="field-error" role="alert">Draft unlock time has expired or is less than 1 minute ahead. Reset or choose a future time.</p>}<p className="caption">Required for deposit, not approval. At least one minute ahead. Up to five years. The release time cannot be shortened.</p><details className="review-box"><summary>Review owner & approval scope</summary><div><span>Withdrawal owner</span><strong className="mono">{w.account ? `${w.account.slice(0, 10)}…${w.account.slice(-6)}` : "Connect your wallet"}</strong></div><div><span>Approval scope</span><strong>{amount && pool ? (() => { try { return `${formatUnits(amountUnits(amount, pool.decimals), pool.decimals)} LP only`; } catch { return "Enter an amount"; } })() : "Exact amount only"}</strong></div><div><span>Network fees</span><strong>Estimated in wallet</strong></div></details>
      {!w.account ? <button className="wide" onClick={() => void w.connect()}>Connect wallet to create a lock ↗</button> : <div className="action-grid"><button className="secondary" aria-describedby="action-status" title={approvalReason || "Approve this exact LP amount"} disabled={Boolean(approvalReason)} onClick={() => void w.execute("Approve LP allowance", signer => prepare(signer, false))}>{approved ? "✓ Exact allowance ready" : "1. Approve LP"}</button><button aria-describedby="action-status" title={depositReason || "Create this lock"} disabled={Boolean(depositReason)} onClick={() => void w.execute("Deposit LP", signer => prepare(signer, true))}>2. Create lock →</button></div>}
      </>}
      {depositComplete && <button className="text-button" onClick={() => { w.dismiss(); setAmount(""); setDate(""); }}>Start another lock</button>}
      <TransactionStatus fallback={approvalReason && !approved ? approvalReason : depositReason || "Ready. Review the amount and unlock time before depositing."} />
      {w.lastLockId && <p className="recent-lock"><Link className="button-link" href={`/locks/${w.lastLockId}`}>View last created lock #{w.lastLockId} →</Link> <Link href="/my-locks">My locks</Link></p>}
      <p className="caption">Approval and deposit are separate transactions. Approval alone does not lock tokens.</p></section></div><div className="bottom-grid"><section className="note"><span className="eyebrow">TRANSPARENT BY DESIGN</span><h3>A commitment anyone can verify.</h3><p>No admin unlock. No upgrade proxy. Only the fixed owner can withdraw after the on-chain release time.</p></section><section className="note proof-note"><span className="eyebrow">EXECUTED ON TESTNET</span><h3>The first lock has come full circle.</h3><p>Increment 1 acquired real LP, deposited it, and withdrew after expiry.</p><Link href="/locks/0">Inspect verified lock #0 →</Link></section></div></>;
}
