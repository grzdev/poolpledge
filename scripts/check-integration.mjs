import { mkdir, writeFile } from "node:fs/promises";
import { TESTNET, ROUTER_ABI, provider, assertTestnet, discoverPair, readPool, mirrorGet } from "@poolpledge/core";
import { Contract } from "ethers";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const rpc = provider(process.env.HEDERA_TESTNET_RPC_URL);
try {
  await assertTestnet(rpc);
  const pair = process.env.PROOF_PAIR_ADDRESS || await discoverPair(rpc);
  const pool = await readPool(pair, rpc);
  const token = await mirrorGet(`/tokens/${pool.lpTokenId}`);
  if (token.deleted || token.type !== "FUNGIBLE_COMMON") throw new Error("Native LP token is deleted or is not fungible.");
  const router = new Contract(TESTNET.router, ROUTER_ABI, rpc);
  if ((await router.factory()).toLowerCase() !== TESTNET.factory.toLowerCase()) throw new Error("Router factory mismatch.");
  const quote = await router.getAmountsOut(10000000n, [TESTNET.whbar, TESTNET.sauce]);
  if (quote[1] === 0n) throw new Error("Router produced no SAUCE quote for the bounded acquisition input.");
  const evidence = { checkedAt: new Date().toISOString(), source: "live Hedera testnet reads", deploymentSource: "https://docs.saucerswap.finance/developers/contracts", pool, nativeToken: { token_id: token.token_id, type: token.type, deleted: token.deleted, decimals: token.decimals }, acquisitionQuote: { inputTinybars: "10000000", outputSauceBaseUnits: quote[1].toString(), executed: false }, mirrorUrl: `${TESTNET.mirror}/tokens/${pool.lpTokenId}`, transactionProof: false };
  await mkdir("evidence", { recursive: true });
  await writeFile("evidence/integration.local.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} catch {
  console.error("Live integration check failed. No success evidence written. Check RPC/network access, canonical deployments, and testnet reset status.");
  process.exitCode = 1;
} finally { rpc.destroy(); }
