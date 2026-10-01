/**
 * Single analytics taxonomy shared by the server sink and the browser client.
 *
 * Adding an event here is the only step required to make it available on both
 * sides. No provider (GA4, PostHog, Plausible) is referenced anywhere: the
 * browser client emits a DOM event and the server sink records to an opt-in
 * store, so a provider integration stays a drop-in change.
 */
export const ANALYTICS_EVENTS = [
  "page_view",
  "link_submitted",
  "link_analyzed",
  "link_cleaned",
  "link_copied",
  "link_opened",
  "qr_generated",
  "qr_downloaded",
  "utm_generated",
  "url_check_requested",
  "url_check_completed",
  "smart_page_created",
  "smart_page_updated",
  "smart_page_published",
  "smart_page_view",
  "smart_block_created",
  "smart_block_view",
  "smart_block_clicked",
  "whatsapp_link_created",
  "whatsapp_link_updated",
  "whatsapp_link_archived",
  "whatsapp_link_view",
  "whatsapp_link_click",
  "whatsapp_redirect",
  "whatsapp_link_copied",
  "whatsapp_qr_created",
  "whatsapp_template_used",
  "whatsapp_optimization_applied",
  "whatsapp_cta_created",
  "whatsapp_campaign_created",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

// Operation results are recorded by their API handlers, never twice via the browser.
export const CLIENT_ANALYTICS_EVENTS = [
  "page_view",
  "link_submitted",
  "link_cleaned",
  "link_copied",
  "link_opened",
  "qr_downloaded",
  "url_check_requested",
  "whatsapp_link_copied",
] as const satisfies ReadonlyArray<AnalyticsEventName>;

export const ANALYTICS_PATHS = [
  "/",
  "/limpar-link",
  "/gerar-utm",
  "/gerar-qrcode",
  "/encurtar",
  "/link-health",
  "/conta",
  "/entrar",
  "/cadastro",
  "/untrack/whatsapp",
] as const;

/** DOM event carrying `{ event }`, dispatched by the browser analytics client. */
export const ANALYTICS_BROWSER_EVENT = "arrume-meu-link:analytics";

export function isAnalyticsEventName(
  value: string,
): value is AnalyticsEventName {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
