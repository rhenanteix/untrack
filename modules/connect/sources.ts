import { createHash, randomBytes } from "node:crypto";
import type { ConnectSource } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-response";
import { universalEventNames } from "@/modules/analytics/event-types";
import { sourceTrusts, sourceTypes, publicEventNames } from "./contract";
import { connectSystem, connectWorkspace } from "./database";
import type { Actor } from "@/modules/workspaces/context";

export const sourceConfigSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,79}$/),
    type: z.enum(sourceTypes),
    trust: z.enum(sourceTrusts),
    projection: z.enum(["isolated", "native"]).default("isolated"),
    allowedOrigins: z
      .array(
        z
          .string()
          .url()
          .refine((value) => {
            const url = new URL(value);
            return (
              value === url.origin &&
              !url.hostname.includes("*") &&
              (url.protocol === "https:" ||
                (["localhost", "127.0.0.1"].includes(url.hostname) &&
                  url.protocol === "http:"))
            );
          }),
      )
      .max(20)
      .default([]),
    allowedEvents: z.array(z.enum(universalEventNames)).min(1).max(50),
    requiresConsent: z.boolean().default(true),
    expectedIntervalSeconds: z
      .number()
      .int()
      .min(60)
      .max(30 * 86_400)
      .optional(),
  })
  .strict()
  .superRefine((source, ctx) => {
    const invalid =
      source.allowedEvents.includes("goal_completed") ||
      (source.projection === "native" &&
        (source.type !== "owned_asset" || source.trust !== "internal")) ||
      (source.trust === "public" &&
        (source.type !== "external_site" ||
          !source.requiresConsent ||
          !source.allowedOrigins.length ||
          source.allowedEvents.some((event) => !publicEventNames.has(event))));
    if (invalid)
      ctx.addIssue({
        code: "custom",
        message: "Incompatible source trust, events, or projection policy",
      });
  });
export type SourceConfig = z.infer<typeof sourceConfigSchema>;
export function credentialDigest(credential: string) {
  return createHash("sha256").update(credential).digest("hex");
}
export function newSourceCredential() {
  return `lc_${randomBytes(32).toString("base64url")}`;
}

/** Operational provisioning only. No browser-facing handler returns credentials. */
export async function provisionSource(workspaceId: string, raw: unknown) {
  const config = sourceConfigSchema.parse(raw);
  const credential = config.trust === "public" ? null : newSourceCredential();
  const source = await connectSystem(async (tx) => {
    const source = await tx.connectSource.create({
      data: {
        ...config,
        workspaceId,
        credentialHash: credential ? credentialDigest(credential) : null,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorId: "system:connect",
        action: "connect.source.provisioned",
        entityId: source.id,
        details: {
          type: source.type,
          trust: source.trust,
          projection: source.projection,
        },
      },
    });
    return source;
  });
  return { source: publicSource(source), credential };
}
export async function authenticateSource(request: Request) {
  if (request.headers.has("origin") || request.headers.has("sec-fetch-site"))
    throw new ApiError(
      403,
      "SERVER_ONLY",
      "Use esta credencial somente no servidor.",
    );
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer lc_[A-Za-z0-9_-]{43}$/.test(authorization))
    throw new ApiError(
      401,
      "SOURCE_UNAUTHORIZED",
      "Credencial de fonte inválida.",
    );
  const credentialHash = credentialDigest(authorization.slice(7));
  const source = await connectSystem((tx) =>
    tx.connectSource.findUnique({ where: { credentialHash } }),
  );
  if (!source?.enabled || source.trust === "public")
    throw new ApiError(
      401,
      "SOURCE_UNAUTHORIZED",
      "Credencial de fonte inválida.",
    );
  return source;
}
export async function publicRequestSource(
  sourceId: string,
  origin: string | null,
) {
  const source = await connectSystem((tx) =>
    tx.connectSource.findUnique({ where: { id: sourceId } }),
  );
  if (
    !source?.enabled ||
    source.trust !== "public" ||
    !origin ||
    !source.allowedOrigins.includes(origin)
  )
    throw new ApiError(
      403,
      "SOURCE_FORBIDDEN",
      "Fonte ou origem não permitida.",
    );
  return source;
}
export function publicSource(source: ConnectSource) {
  const { credentialHash, ...safe } = source;
  void credentialHash;
  return safe;
}
export function listSources(actor: Actor) {
  return connectWorkspace(actor, "read", async (tx) =>
    (
      await tx.connectSource.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    ).map(publicSource),
  );
}

export async function rotateSourceCredential(
  workspaceId: string,
  sourceConnectionId: string,
) {
  const credential = newSourceCredential();
  const source = await connectSystem(async (tx) => {
    const current = await tx.connectSource.findFirst({
      where: { id: sourceConnectionId, workspaceId, trust: { not: "public" } },
    });
    if (!current)
      throw new ApiError(404, "SOURCE_NOT_FOUND", "Fonte não encontrada.");
    const updated = await tx.connectSource.update({
      where: { id: current.id },
      data: { credentialHash: credentialDigest(credential) },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        actorId: "system:connect",
        action: "connect.source.credential_rotated",
        entityId: current.id,
        details: {},
      },
    });
    return updated;
  });
  return { source: publicSource(source), credential };
}
