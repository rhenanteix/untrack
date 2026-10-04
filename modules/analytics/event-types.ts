export const AnalyticsEvents = {
  PAGE_VIEW: "page_view",
  BLOCK_VIEW: "block_view",
  SMART_PAGE_VIEW: "smart_page_view",
  SMART_CARD_VIEW: "smart_card_view",
  SMART_CARD_QR_SCAN: "smart_card_qr_scan",
  APPLE_WALLET_ADD_CLICK: "apple_wallet_add_click",
  GOOGLE_WALLET_ADD_CLICK: "google_wallet_add_click",
  APPLE_WALLET_ADD_CONFIRMED: "apple_wallet_add_confirmed",
  GOOGLE_WALLET_ADD_CONFIRMED: "google_wallet_add_confirmed",
  LINK_CLICK: "link_click",
  BUTTON_CLICK: "button_click",
  SOCIAL_CLICK: "social_click",
  WHATSAPP_CLICK: "whatsapp_click",
  PRODUCT_VIEW: "product_view",
  PRODUCT_CLICK: "product_click",
  QR_SCAN: "qr_scan",
  FORM_VIEW: "form_view",
  FORM_SUBMIT: "form_submit",
  LEAD_CREATED: "lead_created",
  CAMPAIGN_VIEW: "campaign_view",
  CAMPAIGN_CLICK: "campaign_click",
  GOAL_COMPLETED: "goal_completed",
  SAVE_CONTACT_CLICK: "save_contact_click",
  SHARE_DETAILS_OPEN: "share_details_open",
  SHARE_DETAILS_SUBMIT: "share_details_submit",
  WEBSITE_CLICK: "website_click",
  CHECKOUT_VIEW: "checkout_view",
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_COMPLETED: "checkout_completed",
  PAYMENT_COMPLETED: "payment_completed",
} as const;

export const universalEventNames = [
  AnalyticsEvents.PAGE_VIEW,
  AnalyticsEvents.BLOCK_VIEW,
  AnalyticsEvents.SMART_PAGE_VIEW,
  AnalyticsEvents.SMART_CARD_VIEW,
  AnalyticsEvents.SMART_CARD_QR_SCAN,
  AnalyticsEvents.APPLE_WALLET_ADD_CLICK,
  AnalyticsEvents.GOOGLE_WALLET_ADD_CLICK,
  AnalyticsEvents.APPLE_WALLET_ADD_CONFIRMED,
  AnalyticsEvents.GOOGLE_WALLET_ADD_CONFIRMED,
  AnalyticsEvents.LINK_CLICK,
  AnalyticsEvents.BUTTON_CLICK,
  AnalyticsEvents.SOCIAL_CLICK,
  AnalyticsEvents.WHATSAPP_CLICK,
  AnalyticsEvents.PRODUCT_VIEW,
  AnalyticsEvents.PRODUCT_CLICK,
  AnalyticsEvents.QR_SCAN,
  AnalyticsEvents.FORM_VIEW,
  AnalyticsEvents.FORM_SUBMIT,
  AnalyticsEvents.LEAD_CREATED,
  AnalyticsEvents.CAMPAIGN_VIEW,
  AnalyticsEvents.CAMPAIGN_CLICK,
  AnalyticsEvents.GOAL_COMPLETED,
  AnalyticsEvents.SAVE_CONTACT_CLICK,
  AnalyticsEvents.SHARE_DETAILS_OPEN,
  AnalyticsEvents.SHARE_DETAILS_SUBMIT,
  AnalyticsEvents.WEBSITE_CLICK,
  AnalyticsEvents.CHECKOUT_VIEW,
  AnalyticsEvents.CHECKOUT_STARTED,
  AnalyticsEvents.CHECKOUT_COMPLETED,
  AnalyticsEvents.PAYMENT_COMPLETED,
] as const;

export type UniversalEventName = (typeof universalEventNames)[number];

export const analyticsAssetTypes = [
  "link",
  "smart_page",
  "smart_card",
  "qr_code",
  "campaign",
  "product",
  "payment_link",
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