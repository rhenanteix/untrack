import type { Plan } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
export const SMART_PAGES_PRODUCT = {
  name: "Smart Pages Premium",
  priceInCents: 4590,
  currency: "BRL",
  checkoutEnabled: false,
} as const;
export const smartPagesPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(SMART_PAGES_PRODUCT.priceInCents / 100);
export function hasSmartPages(plan: Plan) {
  return plan === "pro" || plan === "business";
}
export function requireSmartPages(plan: Plan) {
  if (!hasSmartPages(plan))
    throw new ApiError(
      403,
      "PREMIUM_REQUIRED",
      "O Smart Pages é um produto premium. A cobrança ainda não está disponível; consulte Plano e cotas.",
    );
}
