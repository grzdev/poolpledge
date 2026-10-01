import { lockId } from "@poolpledge/core";
import { getLock } from "../../../../lib/reads";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  let id: bigint;
  try { id = lockId((await context.params).id); }
  catch { return Response.json({ error: "Invalid lock ID." }, { status: 400 }); }
  try {
    const lock = await getLock(id);
    return lock ? Response.json(lock, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Lock not found on this deployment." }, { status: 404 });
  } catch { return Response.json({ error: "Cannot read the lock from Hedera right now. Retry shortly." }, { status: 502 }); }
}
