import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import { enforceSameOrigin } from "@/lib/request-origin";

export async function saveCloudHistory(
  request: Request,
  originalUrl: string,
  resultUrl: string,
  kind: "clean" | "utm" | "qr",
) {
  const session = await sessionFromHeaders(request.headers);
  if (!session) return false;
  enforceSameOrigin(request);
  await getPrisma().linkHistory.create({
    data: { userId: session.user.id, originalUrl, resultUrl, kind },
  });
  return true;
}
