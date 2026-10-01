# PoolPledge

An original MIT Scaffold HBAR template for **factory-verified SaucerSwap V1 liquidity commitments**. Lock a pool's native HTS LP tokens until a fixed time and share an independently readable custody page. Built for launchpads, treasury commitments and grant-funded liquidity; it does not assess token safety or promise returns.

**Testnet only · unaudited.** A real LP acquisition, deposit and mature withdrawal completed on September 30, 2026. See [transaction evidence](docs/TRANSACTIONS.md), [validation status](docs/VERIFICATION.md), [architecture](docs/ARCHITECTURE.md) and [comparison with eight built-in templates](docs/ASSESSMENT.md). The public repository is https://github.com/grzdev/poolpledge; external-template validation is recorded in the ledger. Browser wallet connection and signed browser transactions remain unverified.

## Prerequisites

- Node **22.13+ within Node 22**, or **Node 24** (`^22.13.0 || ^24.0.0`); Node 24.20.0 is the locally tested version in `.nvmrc`. Use a 64-bit platform. This is stricter than the bounty's minimum Node 20.18.3; unsupported odd-numbered releases are excluded.
- npm and Git. All three workspaces share the committed `package-lock.json`; use npm, not Yarn or pnpm.
- Network access to npm, the testnet JSON-RPC relay and mirror node. Public browsing and local tests need no key or environment file.
- For signing only: an external EVM wallet or a funded testnet ECDSA account. Test assets have no monetary value.

## Scaffold and run

Run from a clean parent directory:

```sh
npm create scaffold-hbar@latest my-test-app -- --template grzdev/poolpledge
cd my-test-app
npm ci
npm run dev
```

Select **testnet** if prompted. The manifest constrains the template to Next.js App Router, Hardhat and npm. The CLI consumes `template.json` during generation. See the verification ledger for the tested revision and exact command results.

For a source checkout, run `npm ci` and `npm run dev` from the root. Open http://127.0.0.1:3000. The supplied UI reads the **included example deployment** at `0xdad7601722A26f3B3418F7a473F4714A189EE682`; `/locks/0` shows its completed proof. You do not own its historical lock, and installing the app does not deploy a contract.

## Try with an external test wallet

Open `/test-wallet` for the guided setup. Create a dedicated test account using the wallet's [official setup instructions](https://support.metamask.io/start/getting-started-with-metamask), then connect using an injected EVM wallet. PoolPledge never asks for a seed phrase or private key. Use the app's switch-network action and verify **Hedera Testnet, chain 296 (0x128)**, RPC `https://testnet.hashio.io/api`, native currency HBAR and explorer `https://hashscan.io/testnet`.

Use the [official Hedera faucet](https://portal.hedera.com/faucet) and confirm the funded public account matches your connected wallet. A faucet/portal-created account and an unrelated wallet account are not interchangeable. Mobile users need a wallet browser that injects an EVM provider; ordinary mobile browsers may not.

**Test HBAR and LP tokens are different assets.** HBAR pays fees and supplies liquidity. PoolPledge accepts the separate HTS LP token minted by the canonical V1 pool. Follow the acquisition procedure below if the wallet has no LP. The CLI signer and browser wallet must represent the same account for that acquired balance to appear.

The UI discovers and validates the pool, displays the LP balance and decimals, then requests exact approval followed by deposit. Choose a small amount and a future unlock time. Share `/locks/<id>` without requiring viewers to connect. Only the recorded beneficiary can withdraw after expiry. If a transaction is pending, use **Check confirmation** and its explorer link before retrying. Approval alone does not lock LP. The browser does not enforce the CLI budget guard: review each wallet fee quote.

## Validate locally

```sh
npm ci
npm run eligibility:local
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

In another terminal:

```sh
npm run smoke
npm run integration:check
```

`npm run smoke` checks HTML routes, invalid-input responses and live factory/lock reads at `http://127.0.0.1:3000` (override `SMOKE_BASE_URL` for another port). It targets the included example. RPC outages fail the check rather than returning simulated data. On a generated scaffold use `npm run eligibility:local -- --scaffolded`, since the CLI removes the source manifest.

CI runs install, local packaging checks, tracked/history secret pattern checks, lint, types, tests and build on Node 22 and 24. Live reads are separate; CI performs no testnet writes. Local tests include boundary mocks and do not prove native HTS behavior. Solidity uses pinned npm solc 0.8.28 with the Paris target, avoiding a separate compiler download.

## Acquire LP and reproduce the verified cycle

The following signing commands spend test HBAR. They are reproduction instructions, **not commands executed during packaging**. Review current fees, balances and saved evidence before writing. The original run spent **6.29279547 test HBAR** including failed-transaction fees and relay contribution, leaving **0.69020453** of its authorization. That remaining amount is not authorization for another cycle.

1. Resolve the actual protocol without credentials:

   ```sh
   npm run integration:check
   ```

   This validates the canonical factory, WHBAR/SAUCE pair, nonzero reserves and separate native LP token. A deleted/reset pool or unavailable upstream stops the flow.

2. Copy `.env.example` to root `.env` using `cp .env.example .env`, or PowerShell `Copy-Item .env.example .env`. Edit locally: set `HEDERA_ACCOUNT_ID` and `DEPLOYER_PRIVATE_KEY` to a matching testnet ECDSA account and raw 32-byte hex key (optional `0x`, not DER or ED25519). Never put these values in chat, shell history or frontend configuration. Scripts check the key/account match and chain 296. Root `.env.local` is also supported as a fallback; keep both ignored.

3. Inspect before repeating any acquisition:

   ```sh
   npm run testnet:account
   ```

   If LP is already held, skip acquisition. This account check performs reads; the write scripts obtain live gas estimates. Default acquisition requires at least **10.2 HBAR available** as a funding precondition, not a planned spend or fee quote.

4. With a separately reviewed fee budget, acquire a small amount:

   ```sh
   npm run testnet:acquire-lp
   ```

   The script associates SAUCE and LP if needed, swaps at most **0.1 HBAR** for SAUCE, approves exact SAUCE to the router, and adds liquidity with at most another **0.1 HBAR**. Each side is capped at 0.1 HBAR; defaults use a 1% minimum-output tolerance. Fees are additional. It verifies LP balance growth and clears residual router allowance after successful minting. After a failed step, inspect saved receipts, balances and allowance before resuming; do not blindly repeat acquisition. LP remains in your account; removal of liquidity is not implemented.

5. Leave `POOLPLEDGE_ADDRESS` blank to deploy **your own** contract as part of the proof, or set it to your existing deployment to avoid deploying again:

   ```sh
   npm run testnet:proof
   ```

   The script deploys if needed, registers/associates the authenticated LP, approves an exact LP amount, deposits into a 90-second lock, checks custody and consumed allowance, checks early rejection, waits for maturity, withdraws and verifies restored balances and repeated rejection. The default amount is 1% of held LP (minimum one base unit); `PROOF_LP_AMOUNT` sets exact base units. A deployment or association alone is not successful workflow proof.

   Receipts are saved after each step in ignored `evidence/*.local.json`. `fullWorkflowVerified` becomes true only after deposit and withdrawal assertions pass. Fee accounting uses supported RPC gas estimates, 10% gas headroom, a withdrawal reserve and a **6.983 HBAR cumulative ceiling**, including a reserved 0.2 HBAR principal and all saved transaction fees. Estimates are not guarantees; reconciliation stops subsequent writes if a fee is missing. Do not delete evidence to reset the budget. If the guard stops, review the evidence and propose a new budget before changing its cap.

6. If interrupted after deposit, set `POOLPLEDGE_ADDRESS` and `PROOF_LOCK_ID` from your saved evidence, then run `npm run testnet:withdraw` after maturity. This verifies beneficiary and returned balance but records withdrawal-only evidence; it does not fabricate a complete run.

## Deploy your own UI target

To deploy without executing a lock cycle, configure the CLI account and run `npm run hardhat:deploy`. This is a transaction-writing command subject to the same budget guard. Output goes to ignored `deployments/296.json`; deployment alone is not lock proof.

The frontend **does not read root `POOLPLEDGE_ADDRESS`**. To point it at your deployment, copy only its public address, chain ID, factory and deployment hash to `packages/nextjs/lib/deployment.json`, and copy the ABI to `PoolPledge.abi.json`. Follow [configuration instructions](docs/ARCHITECTURE.md#public-configuration-for-a-new-deployment) to update example links and smoke expectations. Do not retain example verification claims for an untested deployment. Your credentials remain only in the ignored root environment file.

| CLI variable | Purpose |
|---|---|
| `HEDERA_ACCOUNT_ID` | Testnet account matching the ECDSA key |
| `DEPLOYER_PRIVATE_KEY` | CLI-only raw hex signing key |
| `HEDERA_TESTNET_RPC_URL` | Optional CLI RPC override; must be chain 296 |
| `POOLPLEDGE_ADDRESS` | Reuse a public deployment for proof/recovery |
| `PROOF_PAIR_ADDRESS` | Optional canonical V1 pair override |
| `PROOF_LP_AMOUNT` | Exact LP base units; 0 selects the small default |
| `LP_HBAR_BUDGET` | Acquisition amount per side, maximum 0.1 HBAR |
| `PROOF_LOCK_ID` | Existing lock ID for recovery |

## Custody and limitations

The immutable factory authenticates the pair before association. The pair address is **not** its LP token address. Deposits verify exact received balance; only the fixed beneficiary may withdraw after maturity, once. Failed transfers roll back state. No administrator, rescue function, early unlock, protocol fee or proxy exists. Direct token transfers create no lock rights and may be stranded. Withdrawals are user-triggered, not scheduled.

Native token-admin actions, changing liquidity, RPC outages and testnet resets can affect operation. No mainnet support, security audit, production indexer, WalletConnect integration or automated liquidity removal is claimed. [Architecture](docs/ARCHITECTURE.md) explains trust boundaries and local-test limits.

## Repository and submission

- `packages/core`: canonical configuration, minimal ABIs and validated reads.
- `packages/hardhat`: escrow, boundary mocks, tests and signing/evidence scripts.
- `packages/nextjs`: wallet UI, public read API and shareable lock pages.
- `docs`: assessment, architecture, public transaction links and verification ledger.
- `scripts`: read-only checks and repository-maintained packaging checks.

See [publication and clean-scaffold procedure](docs/PUBLICATION.md). `eligibility:local` is our own check, **not an official organizer pass**. No official self-check was located in the current brief, authoring docs or CLI tree. Hedera Harness is not used. Registration, developer-experience survey and final submission are manual organizer steps.

## Licence and official sources

[MIT](LICENSE). Application and contract code are original; no GPL SaucerSwap implementation is copied or vendored. Primary sources checked October 1, 2026:

- [Bounty requirements](https://hedera.com/blog/scaffold-hbar-template-bounty/)
- [External-template authoring](https://docs.hedera.com/solutions/tools/scaffold-hbar/index)
- [Official CLI](https://github.com/hedera-dev/create-scaffold-hbar)
- [SaucerSwap deployments](https://docs.saucerswap.finance/developers/contracts), [V1 liquidity](https://docs.saucerswap.finance/developers/v1/liquidity/adding-liquidity), [HBAR swap](https://docs.saucerswap.finance/developers/v1/swap/swap-hbar-for-tokens)
- [Hedera HTS system contract](https://docs.hedera.com/evm/hedera-services/system-contracts/hts)

Dependency audit: the high findings were patched compatibly; nine low development-tooling entries remain. See [dependency analysis](docs/DEPENDENCIES.md).
