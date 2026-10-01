// Conservative pattern scan. Prints paths/rule names only, never matched values.
import { execFileSync } from "node:child_process";
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const rules = [
  ["private-key assignment", /(?:DEPLOYER_PRIVATE_KEY|PRIVATE_KEY|privateKey)\s*[=:]\s*["']?(?:0x)?[a-f\d]{64}/i],
  ["private-key PEM", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub credential", /(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,})/],
  ["credential-bearing URL", /https?:\/\/[^\s/:]+:[^\s/@]+@/],
];
let failures = 0;
let scanned = 0;
function inspect(path, body) {
  scanned++;
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith(".env.example") || /\.(pem|key)$|\.local\.json$/.test(path) || /^(?:\.research|\.verification|deployments)\//.test(path)) {
    console.error(`FAIL excluded path: ${path}`); failures++;
  }
  for (const [name, regex] of rules) if (regex.test(body)) { console.error(`FAIL ${name}: ${path}`); failures++; }
}
const paths = git(["ls-files", "-z"]).split("\0").filter(Boolean);
if (!paths.length) throw new Error("No tracked files: stage the publication allowlist before scanning.");
for (const path of paths) inspect(path, git(["show", `:${path}`]));
let commits = [];
try { commits = git(["rev-list", "--all"]).trim().split("\n").filter(Boolean); } catch { /* Unborn repository has no history. */ }
const seen = new Set();
for (const commit of commits) {
  for (const line of git(["ls-tree", "-r", commit]).trim().split("\n").filter(Boolean)) {
    const [meta, path] = line.split("\t");
    const [, type, oid] = meta.split(" ");
    if (type !== "blob" || seen.has(`${oid}:${path}`)) continue;
    seen.add(`${oid}:${path}`);
    inspect(path, git(["cat-file", "blob", oid]));
  }
}
console.log(`${failures ? "FAIL" : "PASS"} ${scanned} staged/history file versions; ${commits.length} commits. Pattern scan only; not proof that every possible secret format is absent.`);
process.exitCode = failures ? 1 : 0;
