import type { Plan, WorkspaceRole } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
export const RESOURCES = [
  "members",
  "clients",
  "campaigns",
  "shortLinks",
  "utmLinks",
  "templates",
  "qrCodes",
  "dynamicQr",
  "domains",
  "history",
  "smartPages",
] as const;
export type Resource = (typeof RESOURCES)[number];
export const PLAN_LIMITS: Record<Plan, Record<Resource, number>> = {
  free: {
    members: 3,
    clients: 5,
    campaigns: 10,
    shortLinks: 50,
    utmLinks: 100,
    templates: 10,
    qrCodes: 20,
    dynamicQr: 0,
    domains: 0,
    history: 1000,
    smartPages: 1,
  },
  pro: {
    members: 10,
    clients: 100,
    campaigns: 200,
    shortLinks: 5000,
    utmLinks: 10000,
    templates: 100,
    qrCodes: 1000,
    dynamicQr: 1000,
    domains: 3,
    history: 20000,
    smartPages: 10,
  },
  business: {
    members: 100,
    clients: 1000,
    campaigns: 5000,
    shortLinks: 100000,
    utmLinks: 100000,
    templates: 1000,
    qrCodes: 20000,
    dynamicQr: 20000,
    domains: 50,
    history: 200000,
    smartPages: 100,
  },
};
export type Permission = "read" | "write" | "manage" | "owner";
const ranks: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};
export function assertPermission(role: WorkspaceRole, permission: Permission) {
  if (ranks[role] < { read: 0, write: 1, manage: 2, owner: 3 }[permission])
    throw new ApiError(403, "FORBIDDEN", "Seu papel não permite esta ação.");
}
