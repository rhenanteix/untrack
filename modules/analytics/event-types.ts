export const universalEventNames = [
  "page_view",
  "block_view",
  "smart_page_view",
  "smart_card_view",
  "smart_card_qr_scan",
  "apple_wallet_add_click",
  "google_wallet_add_click",
  "apple_wallet_add_confirmed",
  "google_wallet_add_confirmed",
  "link_click",
  "button_click",
  "social_click",
  "whatsapp_click",
  "product_view",
  "product_click",
  "qr_scan",
  "form_view",
  "form_submit",
  "lead_created",
  "campaign_view",
  "campaign_click",
  "goal_completed",
  "save_contact_click",
  "share_details_open",
  "share_details_submit",
  "website_click",
  "checkout_view",
  "checkout_started",
  "checkout_completed",
  "payment_completed",
] as const;

export type UniversalEventName = (typeof universalEventNames)[number];

export const analyticsAssetTypes = [
  "link",
  "smart_page",
  "smart_card",
  "qr_code",
  "campaign",
  "product",
] as const;

export type AnalyticsAssetType = (typeof analyticsAssetTypes)[number];

export const analyticsEventOrigins = ["client", "server"] as const;

export type AnalyticsEventOrigin = (typeof analyticsEventOrigins)[number];

export const analyticsChannels = [
  "direct",
  "organic_search",
  "paid_search",
  "organic_social",
  "paid_social",
  "email",
  "messaging",
  "referral",
  "qr",
  "other",
] as const;

export type AnalyticsChannel = (typeof analyticsChannels)[number];

export function isUniversalEventName(
  value: string,
): value is UniversalEventName {
  return (universalEventNames as readonly string[]).includes(value);
}