import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, errorResponse, readJson } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit, releaseQuota, requireActor, workspaceTransaction } from "@/modules/workspaces/context";
import { assertPermission } from "@/modules/workspaces/policy";
import { listResources, mutateResource } from "@/modules/workspaces/resources";
import { buildGovernedUrl } from "@/modules/untrack-utm/engine";
import { saveUtm, savedUtmSchema } from "@/modules/untrack-utm/service";
import { createManagedLink, deleteManagedLink, updateManagedLink } from "@/modules/link-management/service";
import { previewLinkCsv } from "@/modules/link-management/csv";
import { createQrAsset, assertQrOwnership } from "@/modules/untrack-qr/service";
import { renderVerifiedQr } from "@/modules/untrack-qr/render";
import { createDomain, verifyDomain } from "@/modules/domains/service";
import { invalidateLinkCache } from "@/modules/link-management/cache";
export const runtime = "nodejs";
type Context = { params: Promise<{ module: string }> };
function failure(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2003"].includes(error.code)) return errorResponse(new ApiError(409, "RESOURCE_CONFLICT", "Registro duplicado ou associado a outros ativos. Remova as associações antes de excluir."));
  return errorResponse(error);
}
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request), { module } = await context.params;
    const url = new URL(request.url), page = Math.max(1, Math.min(10000, Number(url.searchParams.get("page")) || 1));
    return NextResponse.json(await listResources(actor, module, url.searchParams.get("search") ?? "", Math.floor(page)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
async function mutate(request: Request, context: Context, method: "POST" | "PATCH" | "DELETE") {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request), { module } = await context.params;
    await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const raw = await readJson(request);
    let result: unknown;
    if (module === "utm-preview" && method === "POST") {
      const workspace = await getPrisma().workspace.findUniqueOrThrow({ where: { id: actor.workspaceId } });
      result = buildGovernedUrl(raw, workspace.governance);
    } else if (module === "utm" && method === "POST") result = await saveUtm(actor, raw);
    else if (module === "utm-bulk" && method === "POST") {
      assertPermission(actor.role, "write");
      const input = z.object({ rows: z.array(savedUtmSchema).min(1).max(100) }).strict().parse(raw);
      const rows = [];
      for (const [index, row] of input.rows.entries()) {
        try { rows.push({ row: index + 1, result: await saveUtm(actor, row) }); } catch (error) { rows.push({ row: index + 1, error: error instanceof Error ? error.message : "Falha" }); }
      }
      result = { rows };
    } else if (module === "links" && method === "POST") result = await createManagedLink(actor, raw);
    else if (module === "links" && method === "PATCH") { const input = z.object({ id: z.string(), data: z.unknown() }).strict().parse(raw); result = await updateManagedLink(actor, input.id, input.data); }
    else if (module === "links" && method === "DELETE") { const { id } = z.object({ id: z.string() }).strict().parse(raw); await deleteManagedLink(actor, id); result = { ok: true }; }
    else if (module === "csv" && method === "POST") {
      assertPermission(actor.role, "write");
      const input = z.object({ csv: z.string().max(256000), commit: z.boolean().default(false) }).strict().parse(raw);
      const rows = previewLinkCsv(input.csv);
      if (!input.commit) result = { rows, preview: true };
      else {
        const report = [];
        for (const row of rows) {
          if (row.errors.length) { report.push(row); continue; }
          try { report.push({ ...row, link: await createManagedLink(actor, row.input) }); } catch (error) { report.push({ ...row, errors: [error instanceof Error ? error.message : "Falha ao importar"] }); }
        }
        result = { rows: report, preview: false, imported: report.filter((row) => "link" in row).length };
      }
    } else if (module === "domains" && method === "POST") result = await createDomain(actor, raw);
    else if (module === "domains" && method === "PATCH") { const { id } = z.object({ id: z.string() }).strict().parse(raw); result = await verifyDomain(actor, id); }
    else if (module === "qr-preview" && method === "POST") {
      const input = z.object({ url: z.string().max(8192), visual: z.unknown() }).strict().parse(raw);
      const rendered = await renderVerifiedQr(input.url, input.visual); result = { dataUrl: rendered.dataUrl, warnings: rendered.warnings, verified: true };
    } else if (module === "qrs" && method === "POST") result = await createQrAsset(actor, raw);
    else if (module === "qrs" && method === "PATCH") {
      const input = z.object({ id: z.string(), destinationUrl: z.string().optional(), isActive: z.boolean().optional() }).strict().parse(raw);
      const qr = await assertQrOwnership(actor, input.id);
      if (!qr.redirectId) throw new ApiError(409, "STATIC_QR", "QR estático não pode alterar o destino do arquivo publicado. Crie outro QR.");
      result = await updateManagedLink(actor, qr.redirectId, { destinationUrl: input.destinationUrl, isActive: input.isActive });
    } else if (module === "qrs" && method === "DELETE") {
      const { id } = z.object({ id: z.string() }).strict().parse(raw);
      const qr = await assertQrOwnership(actor, id);
      let cached: { domainKey: string; slug: string } | null = null;
      result = await workspaceTransaction(actor, "write", async (tx) => {
        await tx.qrAsset.delete({ where: { id } }); await releaseQuota(tx, actor.workspaceId, "qrCodes");
        if (qr.redirectId) { cached = await tx.shortLink.delete({ where: { id: qr.redirectId } }); await releaseQuota(tx, actor.workspaceId, "dynamicQr"); }
        await audit(tx, actor, "qr.deleted", id); return { ok: true };
      });
      if (cached) { const value = cached as { domainKey: string; slug: string }; await invalidateLinkCache(value.domainKey, value.slug); }
    } else result = await mutateResource(actor, module, raw, method);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
export const POST = (request: Request, context: Context) => mutate(request, context, "POST");
export const PATCH = (request: Request, context: Context) => mutate(request, context, "PATCH");
export const DELETE = (request: Request, context: Context) => mutate(request, context, "DELETE");
