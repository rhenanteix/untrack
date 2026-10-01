import { z } from "zod";

export const workspaceResourceTypeSchema = z.enum([
  "project",
  "shortLink",
  "smartPage",
  "campaign",
  "utmLink",
  "qrAsset",
  "whatsappLink",
]);

export const projectResourceTypeSchema = workspaceResourceTypeSchema.exclude([
  "project",
]);

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const resourceReferenceSchema = z
  .object({
    resourceType: workspaceResourceTypeSchema,
    resourceId: z.string().min(1).max(200),
  })
  .strict();

export const projectResourceReferenceSchema = resourceReferenceSchema.extend({
  resourceType: projectResourceTypeSchema,
});

export const createTagSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    color: colorSchema.optional().default("#285239"),
  })
  .strict();

export const updateTagSchema = createTagSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const setResourceTagsSchema = z
  .object({ tagIds: z.array(z.string().min(1).max(200)).max(30) })
  .strict();

export const collectionRuleSchema = z
  .object({
    field: z.enum(["resourceType", "name", "tag"]),
    operator: z.enum(["equals", "contains"]),
    value: z.string().trim().min(1).max(120),
  })
  .strict();

export const createCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().default(""),
    projectId: z.string().min(1).max(200).nullable().optional(),
    kind: z.enum(["manual", "smart"]).default("manual"),
    rules: z.array(collectionRuleSchema).max(10).optional().default([]),
  })
  .strict();

export const updateCollectionSchema = createCollectionSchema.partial();

export const reorderCollectionSchema = z
  .object({ ids: z.array(z.string().min(1).max(200)).max(200) })
  .strict();

export const projectMemberSchema = z
  .object({
    userId: z.string().min(1).max(200),
    role: z.enum(["owner", "editor", "viewer"]),
  })
  .strict();

export const searchQuerySchema = z
  .object({ query: z.string().trim().min(1).max(120) })
  .strict();

export function stableSlug(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug || "tag";
}

export type WorkspaceResourceType = z.infer<typeof workspaceResourceTypeSchema>;
export type ProjectResourceType = z.infer<typeof projectResourceTypeSchema>;
export type ResourceReference = z.infer<typeof resourceReferenceSchema>;
export type ProjectResourceReference = z.infer<
  typeof projectResourceReferenceSchema
>;