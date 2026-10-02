import type { Plan } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
export type PlanType = Plan;

export const LINKOR_PREMIUM_PLAN = {
  name: "LinkOr Premium",
  priceInCents: 2990,
  currency: "BRL",
  checkoutEnabled: false,
} as const;
export const premiumPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(LINKOR_PREMIUM_PLAN.priceInCents / 100);

// Existing Smart Pages surfaces consume the unified Premium offering.
export const SMART_PAGES_PRODUCT = LINKOR_PREMIUM_PLAN;
export const smartPagesPrice = premiumPrice;

export function isPremium(plan: Plan) {
  return plan === "premium";
}

export function requirePremium(plan: Plan) {
  if (!isPremium(plan))
    throw new ApiError(
      403,
      "PREMIUM_REQUIRED",
      "Este recurso faz parte do LinkOr Premium. A cobrança ainda não está disponível; consulte o plano do workspace.",
    );
}
