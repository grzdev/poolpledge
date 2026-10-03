"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatUnits } from "ethers";
import { lockId } from "@poolpledge/core";
import { useWallet, WalletNotice, TransactionStatus } from "./wallet";
import { useData } from "./use-data";
import { lockStatus } from "../lib/session.mjs";
import type { LockData } from "../lib/types";
export function FindLock() {
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  return <form id="find-lock" className="find-lock" onSubmit={e => { e.preventDefault(); try { const valid = lockId(id); setError(""); router.push(`/locks/${valid}`); } catch { setError("Enter a non-negative whole-number lock ID, such as 1."); } }}><label htmlFor="find-id">Find a public lock</label><div className="input-action"><input id="find-id" inputMode="numeric" placeholder="Lock ID, e.g. 1" value={id} onChange={e => setId(e.target.value)} aria-describedby={error ? "find-error" : undefined}/><button type="submit">Find lock →</button></div>{error && <p id="find-error" className="field-error" role="alert">{error}</p>}<p className="caption">Anyone can open a lock. No wallet connection required.</p></form>;
}
function WalletLockList({account}: {account: string}) {
  const w = useWallet();
  const [cursor, setCursor] = useState<string | null>(null);
  const query = new URLSearchParams({account});
  if (cursor !== null) query.set("cursor", cursor);
  const {data, loading, error, refresh} = useData<{locks: LockData[]; nextCursor: string | null; scanned: number}>(`/api/locks?${query}`, w.revision);
  return <><div className="panel-heading"><div><h2>Your commitments</h2><p className="muted">Locks where this wallet is the withdrawal owner.</p></div><button className="secondary" disabled={loading} onClick={refresh}>{loading ? "Refreshing…" : "Refresh"}</button></div>{loading && !data && <p role="status" className="notice">Reading wallet locks from Hedera…</p>}{error && <div className="notice error" role="alert"><p>{error} {data && "Previously read results are shown below."}</p><button className="secondary" onClick={refresh}>Retry read</button><button className="text-button" onClick={() => {setCursor(null); refresh();}}>Start from newest</button></div>}{data && <>{data.locks.length ? <div className="lock-list">{data.locks.map(lock => <Link className="lock-card" key={lock.id} href={`/locks/${lock.id}`}><div className="inline"><span className="eyebrow">LOCK #{lock.id}</span><span className={`badge ${lock.withdrawn ? "good" : "warn"}`}>{lockStatus(lock, lock.chainTime)}</span></div><h3>{lock.symbols.join(" / ")}</h3><strong className="lock-amount">{formatUnits(lock.amount, lock.decimals)} <small>LP</small></strong><p>Unlocks {new Date(lock.unlockAt * 1000).toLocaleString()}</p><span className="card-action">View public lock →</span></Link>)}</div> : <div className="empty-state"><h3>{data.nextCursor !== null || cursor !== null ? "No matching locks in this page" : "No locks for this wallet yet"}</h3><p>{data.nextCursor !== null ? "Continue to older records to check the rest of the deployment." : "Create a commitment, or find an existing public lock by ID."}</p><Link className="button-link" href="/">Create a lock →</Link></div>}<div className="pagination"><span className="caption">Scanned {data.scanned} on-chain records · newest first</span><div className="inline">{cursor !== null && <button className="text-button" onClick={() => setCursor(null)} disabled={loading}>Newest records</button>}{data.nextCursor !== null && <button className="secondary" onClick={() => setCursor(data.nextCursor)} disabled={loading}>Older records →</button>}</div></div></>}</>;
}
export function MyLocks() {
  const w = useWallet();
  return <><WalletNotice/><div className="page-heading compact"><div><p className="eyebrow">YOUR ON-CHAIN COMMITMENTS</p><h1>My locks</h1><p className="lede">Follow your liquidity from deposit to release.</p></div><Link className="button-link" href="/">Create a lock →</Link></div><TransactionStatus/><div className="locks-layout"><section className="panel">{w.account ? <WalletLockList key={w.account.toLowerCase()} account={w.account}/> : <div className="empty-state"><h2>Your locks, in one place.</h2><p>Connect a wallet to read its commitments. Connecting does not send a transaction.</p><button onClick={() => void w.connect()}>Connect wallet</button><p><Link href="/test-wallet">Try with a test wallet →</Link></p></div>}</section><section className="panel find-panel"><FindLock/>{w.lastLockId && <Link className="button-link" href={`/locks/${w.lastLockId}`}>View last created lock #{w.lastLockId} →</Link>}</section></div></>;
}
