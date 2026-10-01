"use client";
import { useEffect, useState } from "react";
import { Contract, formatUnits } from "ethers";
import { TESTNET, TOKEN_ABI } from "@poolpledge/core";
import { useData } from "./use-data";
import { useWallet, WalletNotice, TransactionStatus } from "./wallet";
import { withdrawalState } from "../lib/rules.mjs";
import type { LockData } from "../lib/types";
import abi from "../lib/PoolPledge.abi.json";
import deployment from "../lib/deployment.json";
import { AddressLink } from "./pool-workspace";
export function LockDetails({ id }: { id: string }) {
  const w = useWallet();
  const { data: lock, error, loading, refresh } = useData<LockData>(`/api/locks/${encodeURIComponent(id)}`, w.revision);
  const [copied, setCopied] = useState("");
  useEffect(() => { const interval = setInterval(refresh, 30000); return () => clearInterval(interval); }, [refresh]);
  const state = lock ? withdrawalState(lock, w.account, w.chain, lock.chainTime) : "Loading";
  async function share() { try { await navigator.clipboard.writeText(window.location.href); setCopied("Link copied"); } catch { setCopied("Copy this page’s URL from your address bar."); } }
  return <><WalletNotice /><section className="panel lock-panel"><div className="panel-heading"><span className="eyebrow">ON-CHAIN COMMITMENT / #{id}</span><div className="inline"><button className="text-button" onClick={refresh} disabled={loading}>Refresh ↻</button><button className="secondary" onClick={() => void share()}>Copy share link ↗</button></div></div>{copied && <p role="status" className="caption">{copied}</p>}{loading && <p className="loading" role="status">Reading lock from Hedera…</p>}{error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={refresh}>Retry</button></div>}{lock && <><div className="lock-hero"><div><span className="muted">Committed liquidity</span><h2>{formatUnits(lock.amount, lock.decimals)} <span>LP</span></h2><p className="mono muted">{lock.amount} base units · {lock.decimals} decimals</p></div><span className={`badge ${lock.withdrawn ? "good" : "warn"}`}>{lock.withdrawn ? "Withdrawn" : lock.chainTime >= lock.unlockAt ? "Matured" : "Locked"}</span></div><div className="timeline"><div className="done"><i />Deposited</div><div className={lock.chainTime >= lock.unlockAt ? "done" : ""}><i />Expiry reached</div><div className={lock.withdrawn ? "done" : ""}><i />Withdrawn</div></div><dl className="facts"><div><dt>Owner / withdrawal beneficiary</dt><dd><a className="address" target="_blank" rel="noreferrer" href={`${TESTNET.explorer}/account/${lock.beneficiary}`}>{lock.beneficiary} ↗</a></dd></div><div><dt>Original depositor</dt><dd className="mono">{lock.depositor}</dd></div><div><dt>Unlock time</dt><dd>{new Date(lock.unlockAt * 1000).toLocaleString()}<small>{new Date(lock.unlockAt * 1000).toISOString()} · UTC</small></dd></div></dl><details className="technical"><summary>Pool, token & escrow addresses</summary><dl className="facts"><div><dt>Authenticated pool</dt><dd><AddressLink value={lock.pair} /></dd></div><div><dt>Native LP token</dt><dd><AddressLink value={lock.token} token /></dd></div><div><dt>Escrow contract</dt><dd><AddressLink value={deployment.address} /></dd></div></dl></details><dl className="facts"><div><dt>Withdrawn on-chain</dt><dd>{lock.withdrawn ? "Yes · tokens released to the owner" : "No · tokens remain in escrow"}</dd></div></dl><div className="withdraw-box"><div><h3>{state}</h3><p className="muted">{lock.withdrawn ? "This commitment is complete. The same lock cannot be withdrawn again." : "Eligibility uses the latest network time. Refresh after expiry to check again."}</p></div>{!w.account && !lock.withdrawn ? <button onClick={() => void w.connect()}>Connect owner wallet</button> : <button disabled={state !== "Ready to withdraw" || w.busy || loading} onClick={() => void w.execute("Withdraw LP", async signer => {
          const pledge = new Contract(deployment.address, abi, signer);
          if ((await pledge.factory()).toLowerCase() !== TESTNET.factory.toLowerCase()) throw new Error("Deployment factory mismatch.");
          const fresh = await pledge.locks(BigInt(id));
          const block = await signer.provider.getBlock("latest");
          if (!block) throw new Error("Network time unavailable.");
          const eligibility = withdrawalState({ withdrawn: fresh.withdrawn, beneficiary: fresh.beneficiary, unlockAt: Number(fresh.unlockAt) }, await signer.getAddress(), "0x128", block.timestamp);
          if (eligibility !== "Ready to withdraw") throw new Error(eligibility);
          const token = new Contract(fresh.token, TOKEN_ABI, signer);
          if (!await token.isAssociated()) throw new Error("Associate this LP token with your wallet before withdrawing.");
          return pledge.withdraw.populateTransaction(BigInt(id));
        })}>Withdraw LP ↗</button>}</div><p className="caption">Public on-chain read · {new Date(lock.observedAt).toLocaleString()} · No wallet required to verify.</p></>}</section><TransactionStatus actions={["Withdraw LP", "Previously submitted transaction"]} /></>;
}
