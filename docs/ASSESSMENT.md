# Idea assessment — 2026-09-29

## Recommendation

**PoolPledge: factory-verified liquidity commitments for SaucerSwap V1 launches.** A project locks native HTS LP tokens until a declared timestamp and publishes an independently readable lock page. A developer can reuse this for launchpads, treasury commitments, grant-funded liquidity, or community verification.

The SaucerSwap integration is load-bearing: the immutable factory authenticates the pool, then `lpToken()` identifies the actual HTS asset being escrowed. Arbitrary tokens and counterfeit pools cannot enter through the supported path. HTS association is required before custody; approvals and transfers use native token ERC-20 redirect support. Hedera contract execution enforces expiry and beneficiary authorization.

Scope for October 4: one chain, one AMM version, fixed beneficiary, fixed release time, no recurring jobs, no swaps, no cross-chain messages. This keeps the contract small enough for meaningful adversarial tests. The UI provides discovery, exact approval, lock creation, and a shareable verification/withdrawal page. No promise that locking LP makes the underlying project safe.

## Eight built-ins inspected

Inspected official branch READMEs and contract/route trees from `hedera-dev/scaffold-hbar`, with CLI registry/source from `hedera-dev/create-scaffold-hbar` (npm latest observed: 0.4.1). Branch heads:

| CLI use case | Branch commit | Existing behavior | PoolPledge distinction |
|---|---|---|---|
| Blank | `88c8837f451c925476b8250e1281c257022b9bbc` | Generic tooling, HTS examples, debug UI | Complete liquidity commitment journey |
| Hedera demo | `64fc32d2467c7134e0e6dc121d5fd878c9f39ea5` | HCS proof wall, HTS participation badges | Actual LP custody and enforced release |
| Payments scheduler | `5bda7868322a2c7aab8cb681df01c756840bb464` | HSS vault execution and MemeJob DCA | User-triggered withdrawal after maturity, no scheduler |
| Cross-chain DCA | `2b9552e49837330d2a7bba70c71005063d13084b` | HSS → Axelar → Sepolia swaps | Single-chain LP commitment |
| Bridge | `7ce2c05b6cb3feeba3cea87c354ccb6ba41617c9` | Axelar, CCIP, LayerZero | No bridging |
| Oracles | `6aba3aa9770bc4b7b1bcba503407dac9011a6545` | Chainlink, Supra, Pyth adapters | No price feed or valuation claims |
| Tokenize subscriptions | `fac02e8248b31fc6ced1c30e3230072575c688a0` | HTS NFT rental/sales marketplace | Fungible protocol LP escrow, no rental rights |
| x402 | `6fd687cad2e0b6735dd5fb3b6a8a0a0b7b17e92d` | Pay-per-download facilitator | No paywall or facilitator |

The docs spell the subscription key `tokenise-subscriptions`; the inspected repository uses `tokenize-subscriptions`. This discrepancy does not affect our external template.

## Alternatives considered

- Liquidity exit planner with an HCS receipt: easier to ship, but the native service could become merely a receipt attachment. Escrow makes Hedera enforcement central.
- Lending liquidation assistant: dependency on reliable markets, risk data, and protocol-specific testing increases deadline risk.
- Storage notarization: useful, but overlaps the proof-wall shape and requires an additional storage account/service to demonstrate the complete journey.

## Availability and proof

SaucerSwap's current official deployment registry lists testnet V1 factory `0.0.9959`, router `0.0.19264`, WHBAR token `0.0.15058`, and SAUCE `0.0.1183558`. On 2026-09-29 the public testnet mirror returned the factory and router with `deleted: false`, at `0x00000000000000000000000000000000000026e7` and `0x0000000000000000000000000000000000004b40` respectively. These are external protocol deployments, not PoolPledge deployments.

Contract existence does not establish usable liquidity or possession of LP tokens. A live probe must resolve `getPair`, check reserves, read `lpToken`, and inspect that native token. Public RPC rate limits and testnet resets can invalidate availability. PoolPledge never substitutes a mock into live mode.

Proof plan (tightened before UI implementation): from the fresh public scaffold, identify a canonical pair and obtain actual LP tokens; deploy PoolPledge, associate the LP token, approve an exact amount, lock, reject early withdrawal, wait for expiry, withdraw, and verify balances return and repeated withdrawal fails. Only this complete cycle counts as workflow proof. Deployment and registration are intermediate evidence only. Missing testnet LP funds must remain an explicit full-lifecycle blocker.

Live factory query on 2026-09-29 resolved the WHBAR/SAUCE pair to `0xfe7cc3ceb7b1128bfc3889184e2d5561bf74bfb3`. Reserves, native LP identity, and account balance must still be checked by the integration/account scripts. The official [V1 liquidity guide](https://docs.saucerswap.finance/developers/v1/liquidity/adding-liquidity) and [HBAR swap guide](https://docs.saucerswap.finance/developers/v1/swap/swap-hbar-for-tokens) describe an acquisition path: associate output SAUCE, swap a bounded amount of faucet HBAR, associate the LP token, approve exact SAUCE for the router, and call `addLiquidityETH`. The acquisition script defaults to at most 0.1 HBAR for the swap plus 0.1 HBAR for liquidity, excluding fees. A documented path is not an executed or proven path.

## Risks

Escrow code requires tests for spoofed pools, early/unauthorized/double withdrawal, transfer failures, reentrancy, and multiple deposit liabilities. HTS integration requires live validation; EVM mocks cannot reproduce native permissions. This is an unaudited testnet template. Mainnet writes are intentionally absent. The time lock does not prevent token-admin actions in the underlying assets, market losses, or testnet resets.

## Primary sources

- [Full bounty brief](https://hedera.com/blog/scaffold-hbar-template-bounty/) — read before implementation.
- [Current authoring docs](https://docs.hedera.com/solutions/tools/scaffold-hbar/index) — read in full before implementation.
- [Template branches](https://github.com/hedera-dev/scaffold-hbar/branches)
- [CLI manifest schema and processing](https://github.com/hedera-dev/create-scaffold-hbar/tree/main/src)
- [Canonical SaucerSwap deployments](https://docs.saucerswap.finance/developers/contracts)
- [SaucerSwap V1 interface/source reference](https://github.com/saucerswaplabs/saucerswaplabs-core) — inspected only; GPL implementation is not vendored.
- [Hedera HTS system contract](https://docs.hedera.com/evm/hedera-services/system-contracts/hts)
- [Hedera system contracts and interfaces](https://docs.hedera.com/evm/hedera-services/system-contracts)

The brief promises an eligibility script, but no linked script was found in the supplied docs, CLI scripts directory, template trees, or official-site search at assessment time. A local checklist will be clearly labeled as our own, not the organizer's gate. Hedera Harness is not used.
