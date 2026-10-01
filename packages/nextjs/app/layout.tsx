import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider, WalletButton } from "../components/wallet";
import deployment from "../lib/deployment.json";
import "./globals.css";
export const metadata: Metadata = { title: "PoolPledge — Verifiable liquidity commitments", description: "Authenticate SaucerSwap V1 pools, lock native HTS LP tokens, and verify release on Hedera testnet." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><WalletProvider><a className="skip-link" href="#main">Skip to content</a><header className="header"><Link className="brand" href="/"><span className="brand-mark">P<span>·</span></span>PoolPledge<span className="brand-tag">WORKSPACE</span></Link><WalletButton /></header><div className="shell"><aside className="sidebar"><div><span className="eyebrow">LIQUIDITY TOOLKIT</span><nav aria-label="Workspace"><Link href="/">◈ <span>Create a lock</span><span>↗</span></Link><Link href="/locks/0">◷ <span>Verified example</span><span>↗</span></Link><a href={`https://hashscan.io/testnet/contract/${deployment.address}`} target="_blank" rel="noreferrer">⌘ <span>Contract explorer</span><span>↗</span></a></nav></div><div className="sidebar-note"><span className="network-dot" /> HEDERA TESTNET<p>Native HTS tokens.<br />Verifiable commitments.</p><span className="caption">Test assets only · Unaudited</span></div></aside><main id="main">{children}<footer><span>PoolPledge / MIT open-source template</span><span>Powered by Hedera + SaucerSwap V1</span></footer></main></div></WalletProvider></body></html>;
}
