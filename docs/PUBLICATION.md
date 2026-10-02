# Publication and clean external scaffold

Public repository: https://github.com/grzdev/poolpledge

The first published implementation commit is `516c414bef147e4ed0ef5227d6ec8f6dfada0736`. GitHub Actions passed its Node 22 and Node 24 jobs. See [the verification ledger](VERIFICATION.md) for the exact external-scaffold results and any later documentation-only revisions.

## Reproduce without credentials

Use a new empty directory with no copied `.env`, node_modules, build artifacts or local receipts:

```sh
npm create scaffold-hbar@latest poolpledge-check -- --template grzdev/poolpledge
cd poolpledge-check
npm ci
npm run eligibility:local -- --scaffolded
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Choose Testnet and decline optional Hedera Skills if reproducing our setup. In a second terminal in the generated project:

```sh
npm run smoke
npm run integration:check
```

The CLI consumes `template.json` and preserves `.env.example` files. Public reads use the included example deployment. No signing key is needed. An existing npm download cache is not a project build artifact; no local project artifacts should be copied.

The official CLI initializes a new Git repository. Its generated commit is not the source repository commit: record the source revision separately. Its formatter may change whitespace and its npm transform may add package-manager metadata.

## Updating the published repository

Stage named files, run `npm run secrets:check`, review `git diff --cached`, commit and push. Never add local credentials, deployments, local receipts, `.research`, `.verification`, node_modules or generated build artifacts. Check Actions on the new published commit; rerun affected checks when code or packaging changes.

On this Windows workspace, Git may require an exact session-only ownership exception:

```powershell
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='C:/Users/DELL/Documents/Hackathons/hedera'
```

No global wildcard trust is needed. This exception is specific to the workspace created by the sandbox account.

## Submission

Supply the public repository and [deployment/deposit/withdrawal evidence](TRANSACTIONS.md), complete registration and the developer-experience survey, then submit through the current bounty page before October 4, 2026, 11:59 PM ET. No organizer self-check was located; the ledger checks the published gate item by item. Harness is not used, so no Harness spec/validators are claimed.

No new testnet writes are part of Increment 4. The historical CLI cycle does not verify signed browser transactions or a signed cycle from the fresh scaffold. Those remain separate and require a new spending proposal before execution.
