import { parse } from "csv-parse/sync";
import { managedLinkSchema } from "./schemas";
import { ApiError } from "@/lib/api-response";
export function previewLinkCsv(csv: string) {
  if (Buffer.byteLength(csv) > 256_000) throw new ApiError(400, "CSV_TOO_LARGE", "CSV limitado a 256 KB e 100 linhas por lote.");
  let records: Record<string, string>[];
  try { records = parse(csv, { columns: true, bom: true, skip_empty_lines: true, max_record_size: 10000, relax_column_count: false }); } catch { throw new ApiError(400, "INVALID_CSV", "CSV inválido. Use cabeçalhos url,title,slug,tags,expiresAt."); }
  if (records.length > 100) throw new ApiError(400, "CSV_TOO_LARGE", "Use lotes de até 100 linhas.");
  const slugs = new Set<string>();
  return records.map((row, index) => {
    const input = { url: row.url, title: row.title || "", slug: row.slug || undefined, tags: row.tags ? row.tags.split("|") : [], expiresAt: row.expiresAt || undefined };
    const parsed = managedLinkSchema.safeParse(input);
    const errors = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    if (row.slug && slugs.has(row.slug)) errors.push("Slug duplicado no lote.");
    if (row.slug) slugs.add(row.slug);
    if (input.expiresAt && new Date(input.expiresAt) <= new Date()) errors.push("Expiração deve estar no futuro.");
    return { row: index + 2, input, errors };
  });
}
