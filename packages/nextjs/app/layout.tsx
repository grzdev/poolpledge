import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider, WalletButton } from "../components/wallet";
import { WorkspaceNav } from "../components/workspace-nav";
import "./globals.css";
export const metadata: Metadata = { title: "PoolPledge — Verifiable liquidity commitments", description: "Authenticate SaucerSwap V1 pools, lock native HTS LP tokens, and verify release on Hedera testnet." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><WalletProvider><a className="skip-link" href="#main">Skip to content</a><header className="header"><Link className="brand" href="/"><span className="brand-mark">P<span>·</span></span>PoolPledge<span className="brand-tag">WORKSPACE</span></Link><WalletButton /></header><div className="shell"><aside className="sidebar"><div><span className="eyebrow">LIQUIDITY TOOLKIT</span><WorkspaceNav /></div><div className="sidebar-note"><span className="network-dot" /> HEDERA TESTNET<p>Native HTS tokens.<br />Verifiable commitments.</p><span className="caption">Test assets only · Unaudited</span></div></aside><main id="main">{children}<footer><span>PoolPledge / MIT open-source template</span><span>Powered by Hedera + SaucerSwap V1</span></footer></main></div></WalletProvider></body></html>;
}
