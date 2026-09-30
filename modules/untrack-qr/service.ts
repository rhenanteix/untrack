import { randomBytes } from "node:crypto";
import { z } from "zod";
import { webUrlSchema } from "@/modules/validation/url-validation";
import { appUrl } from "@/lib/app-url";
import { ApiError } from "@/lib/api-response";
import { audit, assertReferences, reserveQuota, workspaceTransaction, type Actor } from "@/modules/workspaces/context";
import { renderVerifiedQr, visualSchema } from "./render";
export const qrAssetSchema = z.object({ name: z.string().trim().min(1).max(120), url: webUrlSchema, mode: z.enum(["static", "dynamic"]), visual: visualSchema, campaignId: z.string().nullable().optional() }).strict();
export async function createQrAsset(actor: Actor, raw: unknown) {
  const input = qrAssetSchema.parse(raw);
  const slug = randomBytes(12).toString("base64url");
  const encodedUrl = input.mode === "static" ? input.url : new URL(`/q/${slug}`, appUrl()).href;
  const rendered = await renderVerifiedQr(encodedUrl, input.visual);
  const qr = await workspaceTransaction(actor, "write", async (tx, plan) => {
    await assertReferences(tx, actor.workspaceId, { campaignId: input.campaignId });
    await reserveQuota(tx, actor.workspaceId, plan, "qrCodes");
    let redirectId: string | undefined;
    if (input.mode === "dynamic") {
      await reserveQuota(tx, actor.workspaceId, plan, "dynamicQr");
      const distribution = await tx.shortLink.create({ data: { userId: actor.userId, workspaceId: actor.workspaceId, slug, domainKey: "platform", distribution: "qr", destinationUrl: input.url, title: input.name, campaignId: input.campaignId } });
      redirectId = distribution.id;
    }
    const qr = await tx.qrAsset.create({ data: { workspaceId: actor.workspaceId, name: input.name, mode: input.mode, destinationUrl: input.url, encodedUrl, visual: rendered.visual, campaignId: input.campaignId, redirectId } });
    await audit(tx, actor, "qr.created", qr.id, { mode: qr.mode, redirectId, campaignId: qr.campaignId });
    return qr;
  });
  return { qr, dataUrl: rendered.dataUrl, warnings: rendered.warnings, verified: true };
}
export async function assertQrOwnership(actor: Actor, id: string) {
  const { getPrisma } = await import("@/lib/prisma");
  const qr = await getPrisma().qrAsset.findFirst({ where: { id, workspaceId: actor.workspaceId } });
  if (!qr) throw new ApiError(404, "QR_NOT_FOUND", "QR não encontrado.");
  return qr;
}
