export const TRACKER_CATEGORIES = {
  utm: [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "utm_source_platform",
    "utm_creative_format",
    "utm_marketing_tactic",
  ],
  google: ["gclid", "dclid", "gbraid", "wbraid"],
  meta: ["fbclid"],
  microsoft: ["msclkid"],
  tiktok: ["ttclid"],
  twitter: ["twclid"],
  mailchimp: ["mc_cid", "mc_eid"],
  analytics: [
    "_ga",
    "_gl",
    "mkt_tok",
    "vero_id",
    "wickedid",
    "oly_anon_id",
    "oly_enc_id",
    "elqtrackid",
    "elqtrack",
  ],
  generic: [
    "igshid",
    "si",
    "s_cid",
    "soc_src",
    "soc_trk",
    "share_id",
    "share_token",
    "email_hash",
    "li_fat_id",
    "yclid",
  ],
} as const;

export type TrackerCategory = keyof typeof TRACKER_CATEGORIES;

const EXACT_TRACKERS = new Map<string, TrackerCategory>(
  Object.entries(TRACKER_CATEGORIES).flatMap(([category, names]) =>
    names.map((name) => [name, category as TrackerCategory]),
  ),
);

const TRACKER_PREFIXES: ReadonlyArray<readonly [string, TrackerCategory]> = [
  ["utm_", "utm"],
  ["pk_", "analytics"],
  ["mtm_", "analytics"],
  ["hsa_", "google"],
  ["vero_", "analytics"],
];

export function getTrackerCategory(parameter: string): TrackerCategory | null {
  const normalized = parameter.toLowerCase();
  const exact = EXACT_TRACKERS.get(normalized);
  if (exact) return exact;
  return (
    TRACKER_PREFIXES.find(([prefix]) => normalized.startsWith(prefix))?.[1] ??
    null
  );
}
