import { z } from "zod";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const projectStatusSchema = z.enum(["active", "archived"]);

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatório").max(120),
    description: z.string().trim().max(500).optional().default(""),
    icon: z.string().trim().min(1).max(40).optional().default("folder"),
    color: colorSchema.optional().default("#285239"),
  })
  .strict();

export const updateProjectSchema = createProjectSchema.partial();

export const projectListQuerySchema = z
  .object({
    search: z.string().trim().max(120).default(""),
    status: z.enum(["active", "archived", "all"]).default("active"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();

export function projectSlug(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || "project";
}

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;