# Working on PoolPledge

PoolPledge is an original MIT Scaffold HBAR external template. Read README.md and docs/ASSESSMENT.md first.

## Layout and commands

- `packages/hardhat`: Solidity escrow, local boundary mocks, deployment/proof scripts.
- `packages/nextjs`: Next.js App Router, public read API, injected EVM wallet interactions.
- `packages/core`: shared ABI, canonical deployment configuration and validated pool reads.
- Run `npm ci`, `npm run lint`, `npm test`, `npm run build`, then `npm run smoke` with the app running.
- `npm run integration:check` performs live read-only checks; local tests do not prove HTS behavior.

## Invariants

1. Authenticate a pool against the immutable SaucerSwap factory before associating or accepting its LP token. The pair address is NOT its HTS LP token address.
2. Escrow liabilities must never exceed the received balance. Reject zero deposits, unexpected balance deltas, invalid beneficiaries, and past unlock times.
3. Only the immutable beneficiary may withdraw, only after maturity, and only once. No admin rescue of deposited LP tokens and no upgrade proxy.
4. Protect state-changing entry points from reentrancy. Revert failed HTS response codes and failed token transfers.
5. Never use JavaScript floating point for token base units. Use bigint and serialize amounts as strings.
6. The browser must explicitly check chain 296 before signing. Never put private keys into Next.js or NEXT_PUBLIC variables.
7. Do not fabricate balances, addresses, transactions, screenshots, test results, or eligibility passes. An unavailable upstream is an error, not an empty successful response.

## Safety and evidence

Use testnet only. Keep `.env`, private keys, research clones, and generated local deployment data ignored. Read secret files only through the relevant signing process; never print them. Stage named files, inspect the diff, and scan tracked files before publishing. Mock HTS is deliberately limited; describe it as such. Do not copy GPL SaucerSwap implementation code into this MIT repository; use independently authored minimal ABI declarations. Record source URLs and retrieval dates when updating canonical deployments. Run the exact public external-template command after publication; a local copy or CLI simulation is not equivalent.

## Packaging and validation

Read docs/ARCHITECTURE.md and docs/VERIFICATION.md before changing deployment configuration. Run npm run typecheck explicitly, and npm run eligibility:local (our own assertions, not an organizer certification). CI targets supported Node 22 and 24; report local and CI results separately. In generated projects the CLI removes template.json; use eligibility:local -- --scaffolded there.

The included UI deployment is a historical example. Root POOLPLEDGE_ADDRESS only affects CLI scripts. Updating the UI requires public deployment/ABI files and corresponding example links and smoke assertions. Never transfer credentials into those files. Exact approval can remain after a rejected deposit; describe remaining allowance only after an on-chain read.

No testnet write is implicit in packaging or validation. Reuse public evidence/increment-1.public.json. The original 6.983 HBAR authorization has only 0.69020453 HBAR remaining; obtain a new spending proposal before further writes. Never delete evidence to bypass cumulative accounting.

Before publication stage a named allowlist, run npm run secrets:check on the index and all history, inspect staged changes and confirm ignored credentials/local artifacts are absent. The pattern scanner does not guarantee detection of every secret format. Preserve MIT attribution. Public scaffolding must use the real public OWNER/REPO; a local copy is only a packaging preflight. Wallet connection, signed browser transactions, CLI testnet proof and clean external installation are distinct evidence categories.
