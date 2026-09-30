import { timingSafeEqual } from "node:crypto";
import { drainClickOutbox } from "@/modules/link-management/redirect";
export async function POST(request: Request) {
  const expected = process.env.OUTBOX_CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const target = `Bearer ${expected}`;
  if (!expected || supplied.length !== target.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(target))) return new Response(null, { status: 401 });
  const processed = await drainClickOutbox();
  return Response.json({ processed }, { headers: { "Cache-Control": "no-store" } });
}
