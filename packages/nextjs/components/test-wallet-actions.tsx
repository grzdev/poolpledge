"use client";
import { useWallet } from "./wallet";
export function TestWalletActions() {
  const w = useWallet();
  return <div className="setup-actions"><div className="inline"><button disabled={w.busy} onClick={() => void w.connect()}>{w.account ? "Reconnect wallet" : "Connect external wallet"}</button><button className="secondary" disabled={!w.account || w.busy || w.chain === "0x128"} onClick={() => void w.switchNetwork()}>Switch to Hedera Testnet</button></div><p role="status">{w.account ? `Connected: ${w.account}. ${w.chain === "0x128" ? "Hedera Testnet selected." : "Switch network before signing."} No transaction has been verified by connecting.` : "Not connected. No transaction will be sent by these setup controls."}</p></div>;
}
