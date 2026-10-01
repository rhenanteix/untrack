import { z } from "zod";
const optionalDate = z.union([z.literal(""), z.iso.date()]).optional();
export const libraryFilterSchema = z
  .object({
    search: z.string().trim().max(120).default(""),
    status: z.string().max(30).default(""),
    clientId: z.string().max(200).default(""),
    campaignId: z.string().max(200).default(""),
    from: optionalDate,
    to: optionalDate,
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "A data inicial deve ser anterior à final.",
  );
export function libraryFilters(url: URL) {
  return libraryFilterSchema.parse(Object.fromEntries(url.searchParams));
}
export function dateFilter(from?: string, to?: string) {
  return from || to
    ? {
        gte: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
        lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
      }
    : undefined;
}
