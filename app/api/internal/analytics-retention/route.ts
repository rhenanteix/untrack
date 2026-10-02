import { timingSafeEqual } from "node:crypto";
import { purgeExpiredAnalytics } from "@/modules/analytics/retention";

export async function POST(request: Request) {
  const expected = process.env.ANALYTICS_CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const target = `Bearer ${expected}`;
  if (
    !expected ||
    supplied.length !== target.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(target))
  )
    return new Response(null, { status: 401 });
  return Response.json(await purgeExpiredAnalytics(), {
    headers: { "Cache-Control": "no-store" },
  });
}