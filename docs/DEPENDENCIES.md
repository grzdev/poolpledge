# Dependency remediation — October 1, 2026

The initial audit reported four high package entries, caused by two vulnerable transitive packages. All are in the Hardhat development/CLI tooling tree, not the Next.js production dependency tree.

| High entry | Dependency path | Impact and compatible fix |
|---|---|---|
| tmp 0.2.6 | @poolpledge/hardhat → solc 0.8.28 → tmp; also hardhat 2.29.1 → solc 0.8.26 → tmp | Non-string temporary-path options can bypass validation and traverse paths. Pinned override updated to 0.2.7. Compilation is local, but build tooling still warrants patching. |
| undici 6.28.0 | @poolpledge/hardhat → hardhat 2.29.1 → undici | Malformed WebSocket responses can cause denial of service; retry interceptor response splitting also reported. Hardhat's network client is affected tooling. Override updated to 6.28.1. PoolPledge uses HTTP RPC, but the vulnerable package was removed regardless. |
| solc | Direct compiler plus Hardhat's internal compiler → tmp | Inherited high finding, resolved by the tmp patch without changing compiler versions or deployed bytecode. |
| hardhat | hardhat → solc/tmp and undici | Inherited high findings resolved by the two patches; Hardhat remains 2.29.1. |

Commands: `npm update tmp undici --package-lock-only`, `npm install`, `npm ls tmp undici`, `npm audit --json`, `npm audit --omit=dev --json`. Updating overrides alone initially retained stale lock entries; targeted update corrected them. No `npm audit fix --force` was used.

After remediation: **0 high, 0 moderate, 0 critical; 9 low package entries**. Production-only audit: **0 findings**. Lint, type checks, contract/script/UI tests and production build are rerun after the change; the verification ledger records outcomes.

## Remaining low finding

One underlying advisory in `elliptic@6.6.1` propagates through seven ethers v5 packages / Hardhat / hardhat-ethers, producing nine low entries. Path: hardhat → @ethersproject/abi → hash → abstract-signer → abstract-provider → transactions → signing-key → elliptic. The advisory describes incorrect ECDSA signatures and possible key exposure under specific conditions; low severity does not mean harmless. No patched elliptic release is listed. npm proposes Hardhat 3.18.1 and hardhat-ethers 4.2.0, both breaking upgrades requiring a separate migration.

PoolPledge's explicit CLI signing uses ethers 6.17.0 (noble curves), and browser signing is delegated to the external wallet. The affected ethers v5 dependency remains in installed development tooling; this is not proof every possible tooling path is unreachable. Keep this testnet-only, avoid introducing ethers v5 signing, and migrate tooling deliberately before production use. No mainnet safety claim is made.

Primary advisory sources checked October 1, 2026:

- [tmp path validation](https://github.com/advisories/GHSA-7c78-jf6q-g5cm)
- [undici WebSocket subprotocol](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5)
- [undici decompression](https://github.com/advisories/GHSA-3wwx-pv8p-q78v)
- [undici retry interceptor](https://github.com/advisories/GHSA-r53p-7pc4-xj5r)
- [elliptic signing](https://github.com/advisories/GHSA-848j-6mx2-7j84)
