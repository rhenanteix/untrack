import { getPrisma } from "@/lib/prisma";
export async function HEAD(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const domain = await getPrisma().customDomain.findUnique({ where: { hostname } });
  return new Response(null, { status: domain ? 200 : 404, headers: { "Cache-Control": "no-store", ...(domain ? { "X-Untrack-Domain": domain.token } : {}) } });
}
