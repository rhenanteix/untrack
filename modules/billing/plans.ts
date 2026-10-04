import { ApiError } from "@/lib/api-response";
import type { AccountAccess } from "./account-access";
export type PlanType = AccountAccess["basePlan"];

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

export function isPremium(access: Pick<AccountAccess, "effectivePlan">) {
  return access.effectivePlan === "premium";
}

export function requirePremium(access: Pick<AccountAccess, "effectivePlan">) {
  if (!isPremium(access))
    throw new ApiError(
      403,
      "PREMIUM_REQUIRED",
      "Este recurso faz parte do LinkOr Premium. Seu período de teste pode ter terminado; conheça o plano Premium para continuar.",
    );
}
