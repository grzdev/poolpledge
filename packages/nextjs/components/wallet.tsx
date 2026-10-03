"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BrowserProvider, Interface, formatUnits, type Eip1193Provider, type JsonRpcSigner, type TransactionReceipt, type TransactionRequest } from "ethers";
import { provider, TESTNET } from "@poolpledge/core";
import { requireWallet, walletError } from "../lib/rules.mjs";
import { walletScope, savedTransaction, legacyWalletName, reconcileReference } from "../lib/session.mjs";
import { useData } from "./use-data";
import type { LockData } from "../lib/types";
import abi from "../lib/PoolPledge.abi.json";
import deployment from "../lib/deployment.json";
import Link from "next/link";

type Injected = Eip1193Provider & { providers?: Injected[]; isMetaMask?: boolean; isOkxWallet?: boolean; isOKExWallet?: boolean; on?: (event: string, handler: () => void) => void; removeListener?: (event: string, handler: () => void) => void };
declare global { interface Window { ethereum?: Injected } }
type Choice = { id: string; name: string; provider: Injected };
type Transaction = { stage: "idle" | "preparing" | "signature" | "pending" | "confirmed" | "rejected" | "error"; label: string; hash?: string; error?: string; lockId?: string };
type Wallet = { account: string; chain: string; error: string; tx: Transaction; busy: boolean; revision: number; scope: string; lastLockId: string; connect: () => Promise<void>; switchNetwork: () => Promise<void>; disconnect: () => void; execute: (label: string, prepare: (signer: JsonRpcSigner) => Promise<TransactionRequest>) => Promise<void>; check: () => Promise<void>; dismiss: () => void };
export const WalletContext = createContext<Wallet | null>(null);
const Context = WalletContext;
export function useWallet() { const value = useContext(Context); if (!value) throw new Error("Missing wallet context"); return value; }
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const idle: Transaction = {stage: "idle", label: ""};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<Choice | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [account, setAccount] = useState("");
  const [chain, setChain] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<Transaction>(idle);
  const [lastLockId, setLastLockId] = useState("");
  const [revision, setRevision] = useState(0);
  const scope = account && chain ? walletScope(deployment.address, chain, account) : "";
  const activeScope = useRef(scope);
  const running = useRef(false);
  const readRpc = useRef<ReturnType<typeof provider> | null>(null);
  const publicRpc = useCallback(() => readRpc.current ??= provider(), []);
  useEffect(() => {
    // EIP-6963 names are self-attested. Never execute wallet-provided icons or select silently.
    const announce = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (!d?.provider?.request || typeof d.info?.uuid !== "string" || typeof d.info?.name !== "string") return;
      const choice = { id: d.info.uuid, name: d.info.name.slice(0, 60), provider: d.provider as Injected };
      setChoices(old => old.some(c => c.provider === choice.provider || c.id === choice.id) ? old : [...old, choice]);
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", announce);
  }, []);
  const sync = useCallback(async () => {
    if (!selected) return;
    try {
      const [accounts, network] = await Promise.all([selected.provider.request({method: "eth_accounts"}), selected.provider.request({method: "eth_chainId"})]);
      const address = accounts[0] || "";
      activeScope.current = address ? walletScope(deployment.address, network, address) : "";
      setAccount(address); setChain(network); setError(""); setRevision(n => n + 1);
    } catch (e) { activeScope.current = ""; setAccount(""); setChain(""); setError(walletError(e)); }
  }, [selected]);
  useEffect(() => {
    if (!selected) return;
    void sync();
    selected.provider.on?.("accountsChanged", sync); selected.provider.on?.("chainChanged", sync); selected.provider.on?.("disconnect", sync);
    return () => { selected.provider.removeListener?.("accountsChanged", sync); selected.provider.removeListener?.("chainChanged", sync); selected.provider.removeListener?.("disconnect", sync); };
  }, [selected, sync]);
  const finish = useCallback((receipt: TransactionReceipt, label: string, key: string) => {
    const iface = new Interface(abi);
    const event = receipt.status === 1 ? receipt.logs.filter(log => log.address.toLowerCase() === deployment.address.toLowerCase()).map(log => { try { return iface.parseLog(log); } catch { return null; } }).find(log => log?.name === "Locked") : undefined;
    const lockId = event?.args.id.toString();
    try {
      localStorage.removeItem(`${key}:pending`);
      localStorage.setItem(`${key}:recent`, JSON.stringify({hash: receipt.hash, label}));
      if (lockId !== undefined) localStorage.setItem(`${key}:last-lock`, lockId);
    } catch { /* Keep visible hash if storage became unavailable. */ }
    if (activeScope.current !== key) return;
    running.current = false;
    setTx(receipt.status === 1 ? {stage: "confirmed", label, hash: receipt.hash, lockId} : {stage: "error", label, hash: receipt.hash, error: "Transaction failed on-chain. Its network fee may still have been charged."});
    if (lockId !== undefined) setLastLockId(lockId);
    setRevision(n => n + 1);
  }, []);
  useEffect(() => {
    activeScope.current = scope;
    running.current = false;
    let active = true;
    async function restore() {
      setTx(idle); setLastLockId("");
      if (!scope) return;
      try {
        const id = localStorage.getItem(`${scope}:last-lock`);
        if (id && /^\d+$/.test(id)) setLastLockId(id);
        const rawPending = localStorage.getItem(`${scope}:pending`);
        const saved = savedTransaction(rawPending || localStorage.getItem(`${scope}:recent`));
        if (!saved) return;
        // Stored references are never confirmation. Block while checking the receipt.
        running.current = true; setTx({stage: "pending", ...saved});
        if (chain !== "0x128") return;
        const recovered = await reconcileReference(JSON.stringify(saved), hash => publicRpc().getTransactionReceipt(hash));
        const receipt = recovered?.receipt;
        if (!active) return;
        if (receipt) finish(receipt, saved.label, scope);
        else setTx({stage: "pending", ...saved, error: "Receipt not available. Check confirmation before another submission."});
      } catch { if (active) setError("Could not restore transaction state. Check your wallet activity before signing again."); }
    }
    void restore();
    return () => { active = false; };
  }, [scope, chain, finish, publicRpc]);
  async function connect() {
    setError("");
    // Legacy fallback is offered only when no standard announcements were received.
    if (!choices.length && window.ethereum) {
      const providers = window.ethereum.providers || [window.ethereum];
      setChoices(providers.map((p, i) => ({id: `legacy-${i}`, name: legacyWalletName(p), provider: p})));
    }
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setChoosing(true);
  }
  async function choose(choice: Choice) {
    setConnecting(true); setError("");
    try { await choice.provider.request({method: "eth_requestAccounts"}); setSelected(choice); setChoosing(false); }
    catch (e) { setError(`Wallet connection: ${walletError(e)}`); }
    finally { setConnecting(false); }
  }
  async function switchNetwork() {
    setError("");
    try {
      if (!selected) throw new Error("Choose a wallet first.");
      try { await selected.provider.request({method: "wallet_switchEthereumChain", params: [{chainId: "0x128"}]}); }
      catch (e) {
        if ((e as {code?: number}).code !== 4902) throw e;
        await selected.provider.request({method: "wallet_addEthereumChain", params: [{chainId: "0x128", chainName: "Hedera Testnet", nativeCurrency: {name: "HBAR", symbol: "HBAR", decimals: 18}, rpcUrls: [TESTNET.rpc], blockExplorerUrls: [TESTNET.explorer]}]});
        await selected.provider.request({method: "wallet_switchEthereumChain", params: [{chainId: "0x128"}]});
      }
      await sync();
    } catch (e) { setError(`Network switch: ${walletError(e)}`); }
  }
  async function check() {
    if (!tx.hash || chain !== "0x128") return;
    const key = scope;
    try {
      const receipt = await publicRpc().getTransactionReceipt(tx.hash);
      if (receipt) finish(receipt, tx.label, key);
      else setTx(current => ({...current, error: "Receipt is not available yet. Do not resubmit; check again or inspect the explorer."}));
    } catch (e) { if (activeScope.current === key) setTx(current => ({...current, error: walletError(e)})); }
  }
  async function execute(label: string, prepare: (signer: JsonRpcSigner) => Promise<TransactionRequest>) {
    if (running.current || !selected || !scope) return;
    const key = scope;
    running.current = true;
    let hash: string | undefined;
    setTx({stage: "preparing", label});
    try {
      if (savedTransaction(localStorage.getItem(`${key}:pending`))) throw new Error("A saved transaction needs reconciliation. Reload and check confirmation before retrying.");
      // Require working persistence before requesting a signature.
      localStorage.setItem(`${key}:storage-check`, "ok"); localStorage.removeItem(`${key}:storage-check`);
      await requireWallet(selected.provider, account);
      const signer = await new BrowserProvider(selected.provider).getSigner(account);
      const request = await prepare(signer);
      const estimate = await signer.estimateGas(request);
      await requireWallet(selected.provider, account);
      if (activeScope.current !== key) throw new Error("Wallet changed. Review the action again.");
      setTx({stage: "signature", label});
      const sent = await signer.sendTransaction({...request, gasLimit: (estimate * 120n + 99n) / 100n});
      hash = sent.hash;
      localStorage.setItem(`${key}:pending`, JSON.stringify({hash, label}));
      if (activeScope.current === key) setTx({stage: "pending", label, hash});
      const receipt = await publicRpc().waitForTransaction(hash, 1, 90000);
      if (!receipt) throw new Error("Confirmation pending. Check the transaction before retrying.");
      finish(receipt, label, key);
    } catch (e) {
      if (activeScope.current !== key) return;
      running.current = Boolean(hash);
      const code = (e as {code?: string | number}).code;
      setTx({stage: hash ? "pending" : code === 4001 || code === "ACTION_REJECTED" ? "rejected" : "error", label, hash, error: walletError(e)});
    }
  }
  function disconnect() { activeScope.current = ""; setSelected(null); setAccount(""); setChain(""); setTx(idle); setLastLockId(""); }
  const busy = ["preparing", "signature", "pending"].includes(tx.stage);
  function dismiss() { if (!busy) { setTx(idle); try { localStorage.removeItem(`${scope}:recent`); } catch { /* optional */ } } }
  return <Context.Provider value={{account, chain, error, tx, busy, revision, scope, lastLockId, connect, switchNetwork, disconnect, execute, check, dismiss}}>{children}{choosing && <div className="wallet-picker" role="dialog" aria-label="Choose a wallet" aria-modal="true"><section className="panel"><h2>Choose a wallet</h2><p>Only the wallet you select will receive the connection request. Wallet names are provided by each extension.</p>{choices.length ? <div className="wallet-options">{choices.map(c => <button key={c.id} disabled={connecting} onClick={() => void choose(c)}>{c.name}</button>)}</div> : <p className="notice">No wallet detected. Open this page in your extension’s browser and reload. <Link href="/test-wallet" onClick={() => setChoosing(false)}>Setup guide</Link></p>}<button className="secondary" disabled={connecting} onClick={() => setChoosing(false)}>Cancel</button>{error && <p role="alert">{error}</p>}</section></div>}</Context.Provider>;
}
export function WalletButton() {
  const w = useWallet();
  return <div className="wallet-area"><div className="wallet-controls"><span className={`testnet-badge ${w.account && w.chain !== "0x128" ? "wrong-network" : ""}`}>{!w.account ? "Hedera Testnet · app network" : w.chain === "0x128" ? "Hedera Testnet · 296" : `Wrong network · ${w.chain}`}</span><Link className="test-wallet-link" href="/test-wallet">Try with a test wallet</Link>{w.account ? <button className="secondary" onClick={w.disconnect} disabled={w.busy} title="Disconnect this app">{short(w.account)} · Disconnect</button> : <button onClick={() => void w.connect()}>Connect wallet ↗</button>}</div>{w.error && <p className="notice error connection-error" role="alert">{w.error}</p>}</div>;
}
export function WalletNotice() {
  const w = useWallet();
  return <>{w.account && w.chain !== "0x128" && <div className="notice warn" role="alert">Signing requires Hedera testnet (chain 296). <button className="secondary" onClick={() => void w.switchNetwork()}>Switch network</button></div>}</>;
}
export function TransactionStatus({ actions, fallback }: { actions?: string[]; fallback?: string }) {
  const { tx, check, dismiss } = useWallet();
  const lock = useData<LockData>(tx.stage === "confirmed" && tx.lockId !== undefined ? `/api/locks/${tx.lockId}` : null);
  const visible = tx.stage !== "idle" && (!actions || actions.includes(tx.label) || tx.stage === "pending");
  if (!visible) return fallback ? <p id="action-status" className="notice action-status" role="status">{fallback}</p> : null;
  const descriptions = {idle: "", preparing: "Validating on-chain state and estimating gas…", signature: "Awaiting your signature in the selected wallet.", pending: "Submitted. Reconciling the network receipt before another action.", confirmed: "Transaction confirmed on Hedera Testnet.", rejected: "Signature rejected. Nothing was submitted by this action.", error: "Transaction could not complete."};
  return <section id="action-status" className={`transaction notice action-status ${tx.stage === "error" ? "error" : ""}`} aria-live="polite"><strong>{tx.stage === "confirmed" && tx.lockId !== undefined ? `Lock #${tx.lockId} created` : tx.label}</strong><p>{descriptions[tx.stage]}</p>{tx.error && <p>{tx.error}</p>}{tx.stage === "confirmed" && tx.lockId === undefined && fallback && !fallback.startsWith("Loading") && <p>Next step: {fallback}</p>}{tx.lockId !== undefined && tx.stage === "confirmed" && <>{lock.data ? <dl className="success-facts"><div><dt>Pair</dt><dd>{lock.data.symbols.join(" / ")}</dd></div><div><dt>Amount</dt><dd>{formatUnits(lock.data.amount, lock.data.decimals)} LP</dd></div><div><dt>Unlock time</dt><dd>{new Date(lock.data.unlockAt * 1000).toLocaleString()}</dd></div></dl> : <p>{lock.error ? "Deposit confirmed; details are temporarily unavailable. Open the public lock page or retry its read." : "Reading the confirmed lock details…"}</p>}</>}<div className="inline">{tx.lockId !== undefined && <Link className="button-link" href={`/locks/${tx.lockId}`}>View lock #{tx.lockId} →</Link>}{tx.hash && <a target="_blank" rel="noreferrer" href={`${TESTNET.explorer}/transaction/${tx.hash}`}>Explorer ↗</a>}{tx.stage === "pending" ? <button className="secondary" onClick={() => void check()}>Check confirmation</button> : !["signature", "preparing"].includes(tx.stage) && <button className="text-button" onClick={dismiss}>Dismiss status</button>}</div></section>;
}
