import { address } from "@poolpledge/core";
import { getPool } from "../../../lib/reads";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let pair: string | undefined, account: string | undefined;
  try {
    pair = params.get("pair") ? address(params.get("pair")) : undefined;
    account = params.get("account") ? address(params.get("account")) : undefined;
  } catch { return Response.json({ error: "Invalid pool or wallet address." }, { status: 400 }); }
  try { return Response.json(await getPool(pair, account), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Pool could not be authenticated or the Hedera RPC is unavailable. Check the address and retry." }, { status: 502 }); }
}
