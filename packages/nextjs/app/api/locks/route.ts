import { address, lockId } from "@poolpledge/core";
import { getWalletLocks } from "../../../lib/reads";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let account: string, cursor: string | null;
  try { account = address(params.get("account")); cursor = params.get("cursor"); if (cursor !== null) lockId(cursor); }
  catch { return Response.json({error: "Provide a valid wallet address and lock cursor."}, {status: 400}); }
  try { return Response.json(await getWalletLocks(account, cursor), {headers: {"Cache-Control": "no-store"}}); }
  catch { return Response.json({error: "Could not read wallet locks. Retry; if the deployment changed, start from the newest page."}, {status: 502}); }
}
