# Publication and clean external scaffold

Publication is currently blocked: this workspace had no Git repository/remote or configured GitHub publication tool. Local preparation does not create a public URL. Replace placeholders below with your own values; do not put a token in a remote URL.

After reviewing the staged publication files and configuring your Git author identity, commit them. Create an **empty public GitHub repository** in your account (no generated README), then add its URL and push:

```sh
npm run secrets:check
git diff --cached --stat
git commit -m "Add PoolPledge Scaffold HBAR template"
git branch -M main
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```

Use your normal Git credential manager or SSH authentication. Do not share credentials in chat. Confirm the repository is accessible while logged out. Record the public URL and source commit in docs/VERIFICATION.md. Check CI; configured CI is not evidence of a successful hosted run.

From a new empty directory outside this source checkout, with no copied `.env`, node_modules, build artifacts or local evidence, execute the exact external command:

```sh
npm create scaffold-hbar@latest my-test-app -- --template OWNER/REPO
cd my-test-app
npm ci
npm run eligibility:local -- --scaffolded
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Select testnet if asked. In a second terminal in the generated app run:

```sh
npm run smoke
npm run integration:check
```

Record CLI version, source commit, Node/npm versions, exit codes, startup URL and route results. The consumed template.json is expected to be absent. Verify both environment examples survived and no actual environment file, local receipt or credential arrived. Existing npm download cache is not project build evidence; for an isolated npm cache set npm_config_cache to a new temporary directory before scaffolding.

Do not execute signing commands in Increment 3. The original CLI testnet cycle is public evidence, but a fresh-scaffold signed cycle remains unverified and requires a new spending proposal. A browser connection is not a signed transaction. Neither may be marked verified without direct evidence.

Before final submission: replace the README OWNER/REPO placeholder with the public slug, rerun the exact command on the final public revision, complete organizer registration and developer-experience survey, and submit the repository plus transaction evidence via the current bounty page. Recheck the deadline and any updated self-check there. The currently inspected deadline is October 4, 2026, 11:59 PM ET.

### Windows sandbox ownership note

This workspace's Git metadata was initialized by the sandbox account. If Git reports dubious ownership in this exact workspace, use the following **session-only** exception before the publication commands (no global wildcard trust):

```powershell
$env:GIT_CONFIG_COUNT='1'
$env:GIT_CONFIG_KEY_0='safe.directory'
$env:GIT_CONFIG_VALUE_0='C:/Users/DELL/Documents/Hackathons/hedera'
```

This is only needed for the present Windows workspace, not a normal fresh clone.
