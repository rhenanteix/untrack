import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { connectWorkspace } from "@/modules/connect/database";
import { sourceConfigSchema, publicSource } from "@/modules/connect/sources";
import { audit, type Actor } from "@/modules/workspaces/context";

export const pixelEvents = [
  "page_view",
  "link_click",
  "cta_click",
  "custom_event",
  "pixel_test",
  "pixel_diagnostic",
] as const;
export const pixelInput = z
  .object({
    origins: sourceConfigSchema.shape.allowedOrigins.unwrap().min(1),
  })
  .strict();
export async function createPixel(actor: Actor, input: unknown) {
  const { origins } = pixelInput.parse(input);
  return connectWorkspace(actor, "manage", async (tx) => {
    const count = await tx.connectSource.count({
      where: { workspaceId: actor.workspaceId, trust: "public" },
    });
    if (count >= 20)
      throw new ApiError(409, "PIXEL_LIMIT", "Limite de 20 sites atingido.");
    const source = await tx.connectSource.create({
      data: {
        workspaceId: actor.workspaceId,
        key: `pixel-${randomUUID()}`,
        type: "external_site",
        trust: "public",
        projection: "isolated",
        requiresConsent: true,
        allowedOrigins: [...new Set(origins)],
        allowedEvents: [...pixelEvents],
      },
    });
    await audit(tx, actor, "pixel.created", source.id);
    return publicSource(source);
  });
}
export async function pixelStatus(
  actor: Actor,
  siteId: string,
  testId?: string,
) {
  if (testId) z.string().uuid().parse(testId);
  return connectWorkspace(actor, "read", async (tx) => {
    const source = await tx.connectSource.findFirst({
      where: {
        id: siteId,
        workspaceId: actor.workspaceId,
        trust: "public",
        type: "external_site",
      },
    });
    if (!source)
      throw new ApiError(404, "PIXEL_NOT_FOUND", "Site não encontrado.");
    const where = {
      workspaceId: actor.workspaceId,
      sourceConnectionId: siteId,
    };
    const recent = {
      ...where,
      receivedAt: { gte: new Date(Date.now() - 30 * 60_000) },
    };
    const [accepted, errors, duplicates, ever, test] = await Promise.all([
      tx.connectReceipt.count({
        where: {
          ...recent,
          state: { notIn: ["rejected", "dead_letter"] },
          eventName: { notIn: ["pixel_test", "pixel_diagnostic"] },
        },
      }),
      tx.connectReceipt.count({
        where: {
          ...recent,
          OR: [
            { state: { in: ["rejected", "dead_letter"] } },
            {
              state: { in: ["queued", "processing"] },
              receivedAt: { lt: new Date(Date.now() - 5 * 60_000) },
            },
          ],
        },
      }),
      tx.connectReceipt.count({
        where: {
          ...recent,
          eventName: "pixel_diagnostic",
          state: { not: "rejected" },
        },
      }),
      tx.connectReceipt.findFirst({
        where: { ...where, state: { notIn: ["rejected", "dead_letter"] } },
        orderBy: { receivedAt: "desc" },
        select: { receivedAt: true },
      }),
      testId
        ? tx.connectReceipt.findFirst({
            where: {
              ...where,
              eventName: "pixel_test",
              state: { notIn: ["rejected", "dead_letter"] },
              rawPayload: { path: ["properties", "test_id"], equals: testId },
            },
            select: { id: true, receivedAt: true, state: true },
          })
        : null,
    ]);
    return {
      source: publicSource(source),
      status:
        !source.enabled || errors
          ? "Precisa de atenção"
          : duplicates
            ? "Possível duplicidade"
            : accepted
              ? "Recebendo eventos"
              : ever
                ? "Instalado, sem eventos recentes"
                : "Não instalado",
      accepted,
      lastReceivedAt: ever?.receivedAt ?? null,
      test,
    };
  });
}
