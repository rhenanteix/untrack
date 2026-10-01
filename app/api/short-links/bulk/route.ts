import { z } from "zod";
import { NextResponse } from "next/server";
import { ApiError, errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  requireActor,
  workspaceTransaction,
  audit,
} from "@/modules/workspaces/context";
import { invalidateLinkCache } from "@/modules/link-management/cache";
export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `bulk-links:${actor.userId}`);
    const input = z
      .object({
        ids: z
          .array(z.string().min(1).max(200))
          .min(1)
          .max(100)
          .refine((ids) => new Set(ids).size === ids.length),
        isActive: z.boolean(),
      })
      .strict()
      .parse(await readJson(request));
    const links = await workspaceTransaction(actor, "write", async (tx) => {
      const records = await tx.shortLink.findMany({
        where: {
          id: { in: input.ids },
          workspaceId: actor.workspaceId,
          distribution: "digital",
        },
        select: { id: true, domainKey: true, slug: true },
      });
      if (records.length !== input.ids.length)
        throw new ApiError(
          404,
          "LINK_NOT_FOUND",
          "Um dos links não está disponível neste workspace. Nenhum link foi alterado.",
        );
      await tx.shortLink.updateMany({
        where: { id: { in: input.ids }, workspaceId: actor.workspaceId },
        data: { isActive: input.isActive },
      });
      await audit(
        tx,
        actor,
        "shortLinks.statusChanged",
        actor.workspaceId,
        input,
      );
      return records;
    });
    await Promise.all(
      links.map((link) => invalidateLinkCache(link.domainKey, link.slug)),
    );
    return NextResponse.json({ updated: links.length });
  } catch (error) {
    return errorResponse(error);
  }
}
