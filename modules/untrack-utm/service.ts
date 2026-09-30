import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { audit, assertReferences, reserveQuota, workspaceTransaction, type Actor } from "@/modules/workspaces/context";
import { builderSchema, buildGovernedUrl } from "./engine";
export const savedUtmSchema = z.object({ name: z.string().trim().min(1).max(120), builder: builderSchema, templateId: z.string().optional(), clientId: z.string().nullable().optional(), campaignId: z.string().nullable().optional() }).strict();
export async function saveUtm(actor: Actor, raw: unknown) {
  const input = savedUtmSchema.parse(raw);
  return workspaceTransaction(actor, "write", async (tx, plan) => {
    await assertReferences(tx, actor.workspaceId, { clientId: input.clientId, campaignId: input.campaignId });
    if (input.templateId && !await tx.utmTemplate.findFirst({ where: { id: input.templateId, workspaceId: actor.workspaceId } })) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template não encontrado.");
    const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: actor.workspaceId } });
    const result = buildGovernedUrl(input.builder, workspace.governance);
    if (result.errors.length) throw new ApiError(422, "GOVERNANCE_ERROR", result.errors.map((error) => `${error.field}: ${error.message}`).join(" "));
    await reserveQuota(tx, actor.workspaceId, plan, "utmLinks");
    const link = await tx.utmLink.create({ data: { workspaceId: actor.workspaceId, name: input.name, originalUrl: input.builder.url, resultUrl: result.url, appliedValues: result.appliedValues, governanceSnapshot: workspace.governance!, templateId: input.templateId, clientId: input.clientId, campaignId: input.campaignId } });
    await audit(tx, actor, "utm.created", link.id, { appliedValues: result.appliedValues, templateId: input.templateId });
    return { link, ...result };
  });
}
