import type { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import type { WorkspaceResourceType } from "./schemas";

type Database = Prisma.TransactionClient | PrismaClient;

export type ResourceSummary = {
  id: string;
  resourceType: WorkspaceResourceType;
  name: string;
  description: string;
  href: string;
  updatedAt: Date;
};

export async function workspaceResource(
  db: Database,
  workspaceId: string,
  resourceType: WorkspaceResourceType,
  resourceId: string,
): Promise<ResourceSummary | null> {
  switch (resourceType) {
    case "project": {
      const resource = await db.project.findFirst({
        where: { id: resourceId, workspaceId },
      });
      return resource
        ? {
            id: resource.id,
            resourceType,
            name: resource.name,
            description: resource.description,
            href: `/untrack/projects/${resource.id}`,
            updatedAt: resource.updatedAt,
          }
        : null;
    }
    case "shortLink": {
      const resource = await db.shortLink.findFirst({
        where: { id: resourceId, workspaceId },
      });
      return resource
        ? {
            id: resource.id,
            resourceType,
            name: resource.title || resource.slug,
            description: resource.destinationUrl,
            href: `/conta/links/${resource.id}`,
            updatedAt: resource.updatedAt,
          }
        : null;
    }
    case "smartPage": {
      const resource = await db.smartPage.findFirst({
        where: { id: resourceId, workspaceId },
      });
      return resource
        ? {
            id: resource.id,
            resourceType,
            name: resource.title,
            description: resource.description,
            href: `/untrack/smart-pages?edit=${resource.id}`,
            updatedAt: resource.updatedAt,
          }
        : null;
    }
    case "campaign": {
      const resource = await db.campaign.findFirst({
        where: { id: resourceId, workspaceId },
      });
      return resource
        ? {
            id: resource.id,
            resourceType,
            name: resource.name,
            description: resource.description ?? resource.objective ?? "",
            href: `/untrack/campaigns/${resource.id}`,
            updatedAt: resource.updatedAt,
          }
        : null;
    }
    case "utmLink": {
      const resource = await db.utmLink.findFirst({
        where: { id: resourceId, workspaceId },
      });
      return resource
        ? {
            id: resource.id,
            resourceType,
            name: resource.name,
            description: resource.resultUrl,
            href: "/untrack/utm",
            updatedAt: resource.createdAt,
          }
        : null;
    }
    case "qrAsset": {
      const resource = await db.qrAsset.findFirst({
        where: { id: resourceId, workspaceId },
      });
      return resource
        ? {
            id: resource.id,
            resourceType,
            name: resource.name,
            description: resource.destinationUrl,
            href: "/untrack/qr",
            updatedAt: resource.createdAt,
          }
        : null;
    }
    case "whatsappLink": {
      const resource = await db.whatsappLink.findFirst({
        where: { id: resourceId, workspaceId },
      });
      return resource
        ? {
            id: resource.id,
            resourceType,
            name: resource.name,
            description: resource.phoneNumber,
            href: `/untrack/whatsapp?edit=${resource.id}`,
            updatedAt: resource.updatedAt,
          }
        : null;
    }
  }
}

export async function requireWorkspaceResource(
  db: Database,
  workspaceId: string,
  resourceType: WorkspaceResourceType,
  resourceId: string,
) {
  const resource = await workspaceResource(
    db,
    workspaceId,
    resourceType,
    resourceId,
  );
  if (!resource)
    throw new ApiError(
      404,
      "RESOURCE_NOT_FOUND",
      "O recurso não pertence a este workspace.",
    );
  return resource;
}

export async function resourceOptions(
  db: Database,
  workspaceId: string,
  limit = 50,
) {
  const [links, pages, campaigns, utms, qrs, whatsappLinks] = await Promise.all([
    db.shortLink.findMany({
      where: { workspaceId, distribution: "digital" },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    db.smartPage.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    db.campaign.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    db.utmLink.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.qrAsset.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.whatsappLink.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
  ]);
  return [
    ...links.map((item) => ({
      id: item.id,
      resourceType: "shortLink" as const,
      name: item.title || item.slug,
      description: item.destinationUrl,
      href: `/conta/links/${item.id}`,
      updatedAt: item.updatedAt,
    })),
    ...pages.map((item) => ({
      id: item.id,
      resourceType: "smartPage" as const,
      name: item.title,
      description: item.description,
      href: `/untrack/smart-pages?edit=${item.id}`,
      updatedAt: item.updatedAt,
    })),
    ...campaigns.map((item) => ({
      id: item.id,
      resourceType: "campaign" as const,
      name: item.name,
      description: item.description ?? item.objective ?? "",
      href: `/untrack/campaigns/${item.id}`,
      updatedAt: item.updatedAt,
    })),
    ...utms.map((item) => ({
      id: item.id,
      resourceType: "utmLink" as const,
      name: item.name,
      description: item.resultUrl,
      href: "/untrack/utm",
      updatedAt: item.createdAt,
    })),
    ...qrs.map((item) => ({
      id: item.id,
      resourceType: "qrAsset" as const,
      name: item.name,
      description: item.destinationUrl,
      href: "/untrack/qr",
      updatedAt: item.createdAt,
    })),
    ...whatsappLinks.map((item) => ({
      id: item.id,
      resourceType: "whatsappLink" as const,
      name: item.name,
      description: item.phoneNumber,
      href: `/untrack/whatsapp?edit=${item.id}`,
      updatedAt: item.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}