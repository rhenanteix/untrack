import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, readJson } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireUser } from "@/lib/session";
import { webUrlSchema } from "@/modules/validation/url-validation";
import {
  actorFor,
  workspaceTransaction,
} from "@/modules/workspaces/context";

const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    image: webUrlSchema.nullable().optional(),
  })
  .strict();

const workspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .min(3)
      .max(80)
      .nullable()
      .optional(),
    logoUrl: webUrlSchema.nullable().optional(),
    timezone: z
      .enum(["America/Sao_Paulo", "UTC", "America/New_York", "Europe/Lisbon"])
      .optional(),
    locale: z.enum(["pt-BR", "en", "es"]).optional(),
  })
  .strict();

const settingsSchema = z
  .object({
    profile: profileSchema.optional(),
    workspace: workspaceSchema.optional(),
    preferences: z
      .object({ notifications: z.boolean().optional() })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (value) => value.profile || value.workspace || value.preferences,
    "Informe uma alteração.",
  );

const workspaceSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  timezone: true,
  locale: true,
  notifications: true,
  plan: true,
} as const;

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const actor = await actorFor(user.id, request.headers);
    const workspace = await getPrisma().workspace.findUniqueOrThrow({
      where: { id: actor.workspaceId },
      select: workspaceSelect,
    });
    return NextResponse.json(
      {
        profile: { name: user.name, email: user.email, image: user.image },
        workspace,
        canManage: actor.role === "owner" || actor.role === "admin",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `account-settings:${user.id}`);
    const actor = await actorFor(user.id, request.headers);
    const input = settingsSchema.parse(await readJson(request));
    if (input.profile) {
      await getPrisma().user.update({
        where: { id: user.id },
        data: input.profile,
      });
    }
    if (input.workspace || input.preferences) {
      await workspaceTransaction(actor, "manage", async (tx) => {
        await tx.workspace.update({
          where: { id: actor.workspaceId },
          data: {
            ...input.workspace,
            ...(input.preferences?.notifications === undefined
              ? {}
              : { notifications: { product: input.preferences.notifications } }),
          },
        });
      });
    }
    return GET(request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `account-delete:${user.id}`);
    const input = z
      .object({ confirmation: z.literal("EXCLUIR") })
      .strict()
      .parse(await readJson(request));
    if (input.confirmation !== "EXCLUIR")
      throw new ApiError(400, "INVALID_CONFIRMATION", "Confirmação inválida.");
    const db = getPrisma();
    await db.$transaction(async (tx) => {
      const ownedMemberships = await tx.workspaceMember.findMany({
        where: { userId: user.id, role: "owner" },
        select: { workspaceId: true },
      });
      const ownedIds = ownedMemberships.map((membership) => membership.workspaceId);
      if (ownedIds.length) {
        const sharedWorkspace = await tx.workspaceMember.findFirst({
          where: { workspaceId: { in: ownedIds }, userId: { not: user.id } },
          select: { workspaceId: true },
        });
        if (sharedWorkspace)
          throw new ApiError(
            409,
            "WORKSPACE_HAS_MEMBERS",
            "Transfira a propriedade dos workspaces compartilhados antes de excluir a conta.",
          );
        await tx.workspace.deleteMany({ where: { id: { in: ownedIds } } });
      }
      await tx.user.delete({ where: { id: user.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}