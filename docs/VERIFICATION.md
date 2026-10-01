# Verification ledger — Increment 3

Updated October 1, 2026. Results below distinguish local preparation from public-template eligibility. No testnet transactions were sent in Increment 3.

## Eligibility checklist

| Gate | Status | Observed evidence |
|---|---|---|
| Original specific use case / ecosystem integration | PASS | SaucerSwap V1 authenticated LP custody; eight-template comparison in ASSESSMENT.md |
| Meaningful native Hedera services | PASS | Real HTS association, exact approval, deposit and mature withdrawal; TRANSACTIONS.md |
| Next.js / Hardhat / npm workspaces | PASS | Three pinned workspaces; clean local install and build |
| Manifest against actual CLI | PASS | Published create-scaffold-hbar 0.4.1 TemplateManifestSchema parsed final manifest using its Zod v3 schema |
| Supported Node range | PASS locally | ^22.13.0 or ^24.0.0; tested Node 24.20.0 / npm 11.19.0 on Windows x64; Node 22 CI configured but not yet executed |
| README / AGENTS / environment examples / MIT / architecture | PASS | Public configuration separated from credentials; own deployment and acquisition instructions |
| Public transaction evidence | PASS | 11 allowlisted receipts including failed association, deployment, deposit and withdrawal |
| Secret pattern scan | PASS with limits | 69 staged files; no matches; zero commits existed, so no historical commits to inspect; ignored secrets not opened |
| Local packaging check | PASS | npm run eligibility:local; repository-maintained, not official certification |
| Clean local install, lint, types, tests, build | PASS | Commands below; 26 tests passed |
| Dependency audit | FAIL / OPEN | npm audit reports 11 findings: 7 low, 4 high; pinned dependencies retained |
| Public GitHub repository | BLOCKED | Git initialized and allowlisted files staged; no remote, public URL or publication tool available |
| Exact public external-template command | BLOCKED | Requires public OWNER/REPO; local index export is not equivalent |
| Hosted CI | BLOCKED | Workflow added for Node 22 and 24; no public repository run yet |
| Official organizer self-check | BLOCKED / NOT LOCATED | None linked in current brief/authoring docs or found in current official CLI tree; no official pass claimed |
| Browser wallet connection | UNVERIFIED | Prior browser checks had no injected wallet; absence handling only |
| Signed browser transactions | UNVERIFIED | Increment 1 proof used CLI signing; it does not prove browser approval/deposit/withdrawal |
| Fresh external-scaffold signed cycle | UNVERIFIED | No new writes authorized in Increment 3 |
| Registration, survey and submission | BLOCKED / MANUAL | Complete via current bounty page after publication and clean-scaffold validation |

## Commands and results

Source checkout: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all exited 0. Tests: 5 shared-core, 11 contract boundary, 5 script evidence, 5 wallet rules.

A separate `.verification/increment-3-clean` directory was exported from the staged Git index using:

```sh
git checkout-index --all --prefix=.verification/increment-3-clean/
```

No root or frontend `.env` / `.env.local`, node_modules, build artifacts, research clones or local receipts were copied. This is a **local packaging preflight**, not a run of the external-template CLI.

From that directory:

| Command | Result |
|---|---|
| npm ci | PASS: 558 packages added, 562 audited; npm 11 noted two unapproved dependency install scripts; subsequent checks passed |
| npm run eligibility:local | PASS |
| npm run lint | PASS |
| npm run typecheck | PASS |
| npm test | PASS: 26 tests; compiled 2 Solidity files from clean source |
| npm run build | PASS: production Next.js build, all core routes generated |
| PORT=3014 npm start | PASS: ready at http://127.0.0.1:3014 (PowerShell uses `$env:PORT='3014'; npm start`) |

The first sandbox install failed on npm-cache permissions; the normal-account retry succeeded. The initial sandbox app passed HTML/invalid-input checks but returned 502 on live RPC reads; network-enabled smoke results are recorded below. These initial failures are not counted as passes.

## Audit limitation

The 4 high-severity package entries are `tmp`, `undici`, and inherited findings in `solc` and `hardhat`. Seven low entries concern `elliptic` and the ethers v5 dependency chain in development tooling. Advisory fixes are reported available by npm, but no broad dependency upgrade was performed in this packaging increment. Review and patch before treating this as production-ready. The audit is not represented as an organizer eligibility rule.

## Official source inspection

- [Bounty brief](https://hedera.com/blog/scaffold-hbar-template-bounty/) and [authoring documentation](https://docs.hedera.com/solutions/tools/scaffold-hbar/index), retrieved October 1, 2026.
- [Official CLI](https://github.com/hedera-dev/create-scaffold-hbar), current main `eae5701a540c2aa98e7e90f6ae92709f963c01bf`; inspected schema, contributor external-template guide and tree for a self-check.
- `npm view create-scaffold-hbar version engines repository --json`: latest observed 0.4.1.
- `npm pack create-scaffold-hbar@0.4.1 --pack-destination .research --ignore-scripts --json`: published tarball SHA-1 `8dfd08e8aa32c9ae8a4b858336e6b38dd1571d96`. Extracted `dist/cli.js`, evaluated only its schema block (`EnvVarSchema` through `TemplateManifestSchema`) with Zod v3, and parsed the final manifest successfully. This validates schema shape, not public download or transformation behavior.

The current brief requires running the npm create command; no linked organizer script was found. An earlier assessment referred to a promised self-check. No unavailable checker is claimed to have run. Hedera Harness is not used.

## Increment 3 file changes

Added `.github/workflows/validate.yml`, `.nvmrc`, `.gitattributes`, `scripts/eligibility.mjs`, `scripts/secrets-check.mjs`, `docs/ARCHITECTURE.md`, `docs/PUBLICATION.md`, `docs/TRANSACTIONS.md`, and `evidence/increment-1.public.json`.

Updated `README.md`, `AGENTS.md`, `.env.example`, `template.json`, `package.json`, root engines metadata in `package-lock.json`, and this ledger. Removed an obsolete fixed-gas cost projection from `packages/hardhat/scripts/check-account.cjs`; write scripts still estimate their own actual calls. Preserved contract logic, UI, ABI, public example deployment, licence and frontend environment example. Git was initialized; no commit, remote or publication was created.

## Remaining submission work

Follow PUBLICATION.md to commit and push the reviewed files to an empty public GitHub repository. Supply its public URL. Then run the exact `npm create scaffold-hbar@latest my-test-app -- --template OWNER/REPO` from a new clean directory, validate the generated app, record the revision and results, and replace README placeholders. Check hosted CI. Resolve the dependency audit, separately verify browser connection/signing if required, and complete organizer registration, survey and submission before the current October 4, 2026 11:59 PM ET deadline. Any new testnet writes require a fresh spending proposal; the remaining original authorization is only 0.69020453 HBAR.

## Final read-only smoke results

With network access enabled, from the clean copy:

```powershell
$env:SMOKE_BASE_URL='http://127.0.0.1:3014'
npm run smoke
npm run integration:check
```

Both exited 0. `/`, `/locks/0`, `/test-wallet` returned 200; invalid account/pair/lock IDs returned 400; an absent lock returned 404. Live pool, account balance/allowance reads and withdrawn lock #0 (71,694 base units) passed. At 2026-10-01T16:39:02Z the canonical pool still had liquidity and LP 0.0.2656383 was a nondeleted fungible token with 8 decimals. The acquisition quote was read-only and was not executed. No browser wallet connection or signature was tested in this increment.
