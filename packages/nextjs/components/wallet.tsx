"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BrowserProvider, Interface, type Eip1193Provider, type JsonRpcSigner, type TransactionReceipt, type TransactionRequest } from "ethers";
import { provider, TESTNET } from "@poolpledge/core";
import { requireWallet, walletError } from "../lib/rules.mjs";
import abi from "../lib/PoolPledge.abi.json";
import deployment from "../lib/deployment.json";
import Link from "next/link";

type Injected = Eip1193Provider & { on?: (event: string, handler: () => void) => void; removeListener?: (event: string, handler: () => void) => void };
declare global { interface Window { ethereum?: Injected } }
type Transaction = { stage: "idle" | "preparing" | "signature" | "pending" | "confirmed" | "error"; label: string; hash?: string; error?: string; lockId?: string };
type Wallet = { account: string; chain: string; error: string; tx: Transaction; busy: boolean; revision: number; connect: () => Promise<void>; switchNetwork: () => Promise<void>; disconnect: () => void; execute: (label: string, prepare: (signer: JsonRpcSigner) => Promise<TransactionRequest>) => Promise<void>; check: () => Promise<void> };
const Context = createContext<Wallet | null>(null);
export function useWallet() { const value = useContext(Context); if (!value) throw new Error("Missing wallet context"); return value; }
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState("");
  const [chain, setChain] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<Transaction>({ stage: "idle", label: "" });
  const [revision, setRevision] = useState(0);
  const running = useRef(false);
  const readRpc = useRef<ReturnType<typeof provider> | null>(null);
  const publicRpc = () => readRpc.current ??= provider();
  const sync = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const [accounts, network] = await Promise.all([window.ethereum.request({ method: "eth_accounts" }), window.ethereum.request({ method: "eth_chainId" })]);
      setAccount(accounts[0] || ""); setChain(network); setError(""); setRevision(n => n + 1);
    } catch (e) { setAccount(""); setChain(""); setError(walletError(e)); }
  }, []);
  useEffect(() => {
    void sync();
    const ethereum = window.ethereum;
    const changed = () => { void sync(); };
    ethereum?.on?.("accountsChanged", changed); ethereum?.on?.("chainChanged", changed); ethereum?.on?.("disconnect", changed);
    // Persist only public transaction identifiers; never wallet credentials.
    try {
      const saved = sessionStorage.getItem(`poolpledge:${deployment.address}:pending`);
      if (saved && /^0x[a-fA-F0-9]{64}$/.test(saved)) {
        running.current = true;
        Promise.resolve().then(() => setTx({ stage: "pending", label: "Previously submitted transaction", hash: saved }));
      }
    } catch { /* Browser storage may be disabled. */ }
    return () => { ethereum?.removeListener?.("accountsChanged", changed); ethereum?.removeListener?.("chainChanged", changed); ethereum?.removeListener?.("disconnect", changed); };
  }, [sync]);
  async function connect() {
    setError("");
    try {
      if (!window.ethereum) throw new Error("No injected wallet found. Install an EVM wallet such as MetaMask, then reload.");
      await window.ethereum.request({ method: "eth_requestAccounts" }); await sync();
    } catch (e) { setError(`Wallet connection: ${walletError(e)}`); }
  }
  async function switchNetwork() {
    setError("");
    try {
      if (!window.ethereum) throw new Error("Connect an EVM wallet first.");
      try { await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x128" }] }); }
      catch (e) {
        if ((e as { code?: number }).code !== 4902) throw e;
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x128", chainName: "Hedera Testnet", nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 }, rpcUrls: [TESTNET.rpc], blockExplorerUrls: [TESTNET.explorer] }] });
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x128" }] });
      }
      await sync();
    } catch (e) { setError(`Network switch: ${walletError(e)}`); }
  }
  function finish(receipt: TransactionReceipt, label: string) {
    running.current = false;
    try { sessionStorage.removeItem(`poolpledge:${deployment.address}:pending`); } catch { /* optional storage */ }
    if (receipt.status !== 1) { setTx({ stage: "error", label, hash: receipt.hash, error: "Transaction reverted on-chain. Refresh before retrying." }); return; }
    const iface = new Interface(abi);
    const event = receipt.logs.filter(log => log.address.toLowerCase() === deployment.address.toLowerCase()).map(log => { try { return iface.parseLog(log); } catch { return null; } }).find(log => log?.name === "Locked");
    setTx({ stage: "confirmed", label, hash: receipt.hash, lockId: event?.args.id.toString() });
    setRevision(n => n + 1);
  }
  async function check() {
    if (!tx.hash) return;
    try {
      const receipt = await publicRpc().getTransactionReceipt(tx.hash);
      if (receipt) finish(receipt, tx.label);
      else setTx(current => ({ ...current, error: "Receipt is not available yet. Keep this hash and check again; do not resubmit." }));
    } catch (e) { setTx(current => ({ ...current, error: walletError(e) })); }
  }
  async function execute(label: string, prepare: (signer: JsonRpcSigner) => Promise<TransactionRequest>) {
    if (running.current) return;
    running.current = true;
    let hash: string | undefined;
    setTx({ stage: "preparing", label });
    try {
      await requireWallet(window.ethereum, account);
      const browser = new BrowserProvider(window.ethereum!);
      const signer = await browser.getSigner(account);
      const request = await prepare(signer);
      const estimate = await signer.estimateGas(request);
      // Recheck after asynchronous reads/estimation, immediately before signing.
      await requireWallet(window.ethereum, account);
      setTx({ stage: "signature", label });
      const sent = await signer.sendTransaction({ ...request, gasLimit: (estimate * 120n + 99n) / 100n });
      hash = sent.hash;
      try { sessionStorage.setItem(`poolpledge:${deployment.address}:pending`, hash); } catch { /* optional storage */ }
      setTx({ stage: "pending", label, hash });
      const receipt = await publicRpc().waitForTransaction(hash, 1, 90000);
      if (!receipt) throw new Error("Confirmation pending. Check the transaction before retrying.");
      finish(receipt, label);
    } catch (e) {
      running.current = Boolean(hash);
      setTx({ stage: hash ? "pending" : "error", label, hash, error: walletError(e) });
    }
  }
  const busy = ["preparing", "signature", "pending"].includes(tx.stage);
  return <Context.Provider value={{ account, chain, error, tx, busy, revision, connect, switchNetwork, disconnect: () => { setAccount(""); setChain(""); }, execute, check }}>{children}</Context.Provider>;
}

export function WalletButton() {
  const w = useWallet();
  return <div className="wallet-area"><div className="wallet-controls"><span className="testnet-badge">Hedera Testnet · 296</span><Link className="test-wallet-link" href="/test-wallet">Try with a test wallet</Link>{w.account ? <><span className={`badge ${w.chain === "0x128" ? "good" : "warn"}`}>{w.chain === "0x128" ? "Testnet · 296" : "Wrong network"}</span><button className="secondary" onClick={w.disconnect} disabled={w.busy} title="Disconnect this app">{short(w.account)} <span aria-hidden>↗</span></button></> : <button onClick={() => void w.connect()}>Connect wallet <span aria-hidden>↗</span></button>}</div>{w.error && <p className="notice error connection-error" role="alert">{w.error}</p>}</div>;
}
export function WalletNotice() {
  const w = useWallet();
  return <>{w.account && w.chain !== "0x128" && <div className="notice warn" role="alert">Signing requires Hedera testnet (chain 296). <button className="secondary" disabled={w.busy} onClick={() => void w.switchNetwork()}>Switch network</button></div>}</>;
}
export function TransactionStatus({ actions }: { actions?: string[] }) {
  const { tx, check } = useWallet();
  if (tx.stage === "idle" || (actions && !actions.includes(tx.label))) return null;
  const descriptions = { preparing: "Validating on-chain state and estimating gas…", signature: "Review and confirm in your wallet.", pending: "Submitted. Waiting for network confirmation.", confirmed: "Confirmed on Hedera testnet.", error: "Action stopped." };
  return <section className={`transaction notice ${tx.stage === "error" ? "error" : ""}`} aria-live="polite"><strong>{tx.label}</strong><p>{descriptions[tx.stage]}</p>{tx.error && <p role="alert">{tx.error}</p>}<div className="inline">{tx.hash && <a target="_blank" rel="noreferrer" href={`${TESTNET.explorer}/transaction/${tx.hash}`}>View transaction ↗</a>}{tx.stage === "pending" && <button className="secondary" onClick={() => void check()}>Check confirmation</button>}{tx.lockId !== undefined && <Link href={`/locks/${tx.lockId}`}>Open lock #{tx.lockId} →</Link>}</div></section>;
}
