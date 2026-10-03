# Increment 4 verification — October 2, 2026

Repository: https://github.com/grzdev/poolpledge

Tested implementation commit: `516c414bef147e4ed0ef5227d6ec8f6dfada0736`. Later ledger/publication-guide changes are documentation only; the source commit below identifies the code actually scaffolded. No testnet writes occurred in Increment 4.

## Dependency remediation

See [dependency paths, advisory impacts and fixes](DEPENDENCIES.md). Compatible overrides changed `tmp` 0.2.6 → 0.2.7 and `undici` 6.28.0 → 6.28.1. `npm update tmp undici --package-lock-only` refreshed stale transitive entries; `npm install` and `npm ls tmp undici` confirmed the patched versions. Compiler, contract, ABI and UI code were preserved.

`npm audit --json`: 0 critical, 0 high, 0 moderate, 9 low package entries. `npm audit --omit=dev --json`: 0 findings. The remaining low elliptic advisory is confined to development dependencies, has no listed patched elliptic version, and npm proposes a breaking Hardhat 3 / plugin 4 migration. It is documented, not dismissed or force-fixed.

## Published CI

[GitHub Actions run 36894554969](https://github.com/grzdev/poolpledge/actions/runs/36894554969) completed successfully on the tested implementation commit. Both `validate (22)` and `validate (24)` passed: install, local eligibility assertions, staged/history secret scan, lint, explicit type checks, tests and production build.

## Actual external-template run

CLI: `create-scaffold-hbar@0.4.1`; local Node 24.20.0 and npm 11.19.0, Windows x64.

Executed from a new empty `.verification/external-increment-4-retry` directory:

```sh
npm create scaffold-hbar@latest poolpledge-check -- --template grzdev/poolpledge
```

**PASS, exit 0.** Selected Testnet; declined optional Hedera Skills. The CLI downloaded the public repository, installed dependencies, formatted files and initialized a new Git repository. An earlier attempt was interrupted before its final result could be recovered; it is not used as the passing evidence.

No local credentials or project artifacts were copied. Both root and frontend `.env.example` files remained. Actual `.env` / `.env.local` files and `*.local.json` receipts were absent. Hardhat source artifacts were absent before validation. `template.json` was consumed as documented. npm download cache was available; it did not substitute local project code or build output. The generated repository's initial commit is distinct from the source commit.

## Published eligibility requirements, checked individually

These are our observed checks against the [official brief](https://hedera.com/blog/scaffold-hbar-template-bounty/), not organizer certification.

| Published requirement | Result | Evidence |
|---|---|---|
| Public external-template repository | PASS | grzdev/poolpledge is publicly readable; exact npm create command exited 0 |
| Separate contract/frontend packages | PASS | packages/hardhat and packages/nextjs, with shared packages/core |
| Next.js + Hardhat/Foundry + npm/Yarn workspaces | PASS | Next.js 16.3.7, Hardhat 2.29.1, npm workspaces |
| Node 20.18.3 or later | PASS | Supported range ^22.13.0 or ^24.0.0; CI passed on 22 and 24 |
| template.json present and valid | PASS | Source manifest present; published CLI accepted and consumed it |
| README.md and AGENTS.md | PASS | Setup, acquisition, own deployment, agent invariants and evidence limitations documented |
| Install, lint and build from fresh scaffold | See command results below | Run on actual generated project, not a local source copy |
| App boots and core routes return OK | See command results below | Public reads only; no testnet writes |
| Meaningful Hedera service with testnet transaction link | PASS | Native HTS association/LP custody; public deployment/deposit/withdrawal receipts in TRANSACTIONS.md |
| No committed secrets or .env | PASS with scanning limits | Allowlisted index and Git history scanned; local credentials/artifacts ignored; scanner is not a universal secret detector |
| MIT, original work | PASS | MIT licence; original escrow/UI/minimal ABIs; no GPL SaucerSwap implementation vendored |
| Harness spec/validators if used | NOT APPLICABLE | Harness not used |

No separate official bounty self-check was located in the current brief, authoring documentation or official CLI tree. The brief directs entrants to run npm create; that command was executed. `eligibility:local` is repository-maintained and is not advertised as the organizer's gate.

## Remaining limitations and submission tasks

No successful browser wallet connection or signed browser approval/deposit/withdrawal has been verified. The historical CLI proof is reused; no new signed cycle was run from the external scaffold. Neither is silently upgraded to a pass. Testnet resets and public RPC availability remain external limitations.

Complete organizer registration, the developer-experience survey and the final submission with repository and transaction links before October 4, 2026, 11:59 PM ET. Include no Harness artifacts because Harness was not used. Any additional signed verification needs a new spending proposal; no part of Increment 4 spends the remaining 0.69020453 HBAR authorization.

## Commands and results from the actual generated project

| Exact command | Result |
|---|---|
| npm ci | PASS, exit 0; 558 packages added, 562 audited; 9 low findings |
| npm run eligibility:local -- --scaffolded | PASS, exit 0; consumed manifest explicitly accounted for |
| npm run lint | PASS, exit 0 |
| npm run typecheck | PASS, exit 0 |
| npm test | PASS, exit 0; 26 tests (5 core, 11 contract, 5 script evidence, 5 wallet rules) |
| npm run build | PASS, exit 0; solc and Next.js production build |
| $env:PORT='3015'; npm start | PASS; production server ready at http://127.0.0.1:3015 |
| $env:SMOKE_BASE_URL='http://127.0.0.1:3015'; npm run smoke | PASS, exit 0; HTML, validation errors and live public testnet reads |

Routes: `/`, `/locks/0`, `/test-wallet` returned 200. Invalid account, pair and lock IDs returned 400; absent lock returned 404. Public pool discovery, separate LP identity, wallet balance/allowance reads and withdrawn lock #0 with 71,694 base units all passed. These are API/HTTP checks, not signed browser verification.

npm emitted deprecation notices and noted two dependency install scripts not approved by npm 11; the full validation still passed. Next.js reported that it ignored the parent source checkout's package.json because it lay outside the generated Git repository. The generated project used its own workspaces and built successfully; no parent output was copied into it.

Before publication, the staged allowlist passed the secret-pattern and excluded-path checks. After publication, scanning the index plus the complete one-commit history passed (140 file versions). No credentials were printed or committed. Any subsequent docs-only update is scanned again before push.

Additional command: npm run integration:check passed with exit 0 at 2026-10-02T08:51:33Z. Canonical WHBAR/SAUCE liquidity remained available; LP 0.0.2656383 was nondeleted with 8 decimals. The acquisition quote was read-only and not executed.

## Browser approval blocker correction — October 2, 2026 (local, not yet published)

The user confirmed connection of account 0.0.10771993 in Chrome/MetaMask, then reported disabled approval. Chrome is not exposed through this session's browser tools, so the exact rendered state could not be inspected. Code inspection reproduced a hidden gate: approval depended on a valid unlock time, and an empty date disabled it without an explanation.

Approval now validates amount/balance independently from the deposit date. Deposit retains future-time validation and fresh on-chain checks before signing. Added a five-minute date shortcut and explicit inline reasons for disconnected/wrong-network wallets, pending/signature state, pool loading/failure/missing data, account mismatch, missing balance/allowance, missing/invalid amount, existing exact approval, and missing/invalid unlock time. Time validation updates while the page is open.

Affected local files: components/pool-workspace.tsx, lib/rules.mjs, lib/rules.d.mts and test/rules.test.mjs in packages/nextjs. These are executable changes after the published/documentation-only comparison, so the prior fresh-scaffold result does not cover this fix. Lint, explicit types, all 6 wallet-rule tests and production build passed. The local production app was restarted on port 3016. Connected Chrome interaction and signed transactions remain pending user confirmation; no transaction submitted, 0 of the new 1.8 HBAR cap spent.

## Completed manual browser cycle — October 2, 2026

The user connected the matching account and manually signed approval, deposit and withdrawal in Chrome/MetaMask. The agent could not directly observe the extension UI. All supplied native hashes were resolved to EVM hashes, successful receipts and independently verified on-chain state. See `evidence/browser-cycle.public.json` for the allowlisted public record (currently local, not yet published).

- Approval: https://hashscan.io/testnet/transaction/0xccd8c474bfa7022f1dbb0501906e1f12a4ccfecae8bc2c82a66cc424e67bd62a — 0.58161600 HBAR.
- Deposit: https://hashscan.io/testnet/transaction/0x608c9464b9c4461bd6e6a5a07c648b46c77e22174eeeb5e792a61ee2390af1cd — 0.17464640 HBAR.
- Withdrawal: https://hashscan.io/testnet/transaction/0xb33b423d22496c758fa05c8315a1850a2c313ca5a0cdfcbcd94039962f637ad6 — 0.04899600 HBAR.

Lock #1 held 71,694 LP base units for beneficiary 0x76643e8359f69829cf7a424eec28b960ae82c804 until 2026-10-02 15:07:21 UTC. Withdrawal confirmed after expiry. Wallet LP returned to 7,169,477 base units; withdrawn=true, escrow balance=0, total liability=0, allowance=0. No repeat approval/deposit or new deployment was submitted. The public lock API was readable without wallet authentication. The localhost sharing URL is usable only where that local server is reachable, not a public hosted site.

Total charged fees including all account transaction records in the cycle: **0.80525840 HBAR**. No failed transactions found. Remaining from the newly authorized 1.8 HBAR: **0.99474160 HBAR**. No LP acquisition or funding transfer occurred. This is separate from Increment 1 historical spending.

The local approval-gate fix and this evidence still need publication and affected external-scaffold/CI validation before claiming the published repository includes them. UI polish is deferred to the next increment. No further signing is needed for this cycle.
