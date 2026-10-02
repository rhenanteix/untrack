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
  "smartCards",
  "audienceContacts",
  "products",
  "projects",
  "collections",
  "whatsappLinks",
] as const;
export type Resource = (typeof RESOURCES)[number];
export const PLAN_LIMITS: Record<Plan, Record<Resource, number>> = {
  free: {
    members: 3,
    clients: 5,
    campaigns: 1,
    shortLinks: 10,
    utmLinks: 100,
    templates: 10,
    qrCodes: 3,
    dynamicQr: 3,
    domains: 0,
    history: 1000,
    smartPages: 1,
    smartCards: 1,
    audienceContacts: 50,
    products: 0,
    projects: 10,
    collections: 20,
    whatsappLinks: 50,
  },
  premium: {
    members: 10,
    clients: 100,
    campaigns: 100000,
    shortLinks: 100000,
    utmLinks: 10000,
    templates: 100,
    qrCodes: 100000,
    dynamicQr: 100000,
    domains: 3,
    history: 20000,
    smartPages: 10,
    smartCards: 5,
    audienceContacts: 5000,
    products: 100,
    projects: 100,
    collections: 250,
    whatsappLinks: 5000,
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
