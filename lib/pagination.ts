import { z } from "zod";

export const PAGE_SIZE = 20;
export function pageNumber(request: Request) {
  return z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .parse(new URL(request.url).searchParams.get("page") ?? 1);
}
