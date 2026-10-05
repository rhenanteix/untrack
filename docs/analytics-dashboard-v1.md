# Analytics Dashboard V1

`/analytics` preserves scalar query parameters and redirects to
`/untrack/analytics`, the authenticated Analytics workspace. The dashboard has
four result-oriented views: Overview, Acquisition, Content, and Conversions.
It consumes only workspace-scoped aggregates of `AnalyticsEvent` and
`AnalyticsConversion`; the browser never reads raw event records.

## Metrics

All queries exclude bot and test traffic. Each metric is calculated within the
same selected workspace, period, asset, campaign, goal, source, and channel
scope.

| Metric               | Formula                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitors             | `COUNT(DISTINCT AnalyticsEvent.visitorId)`                                                                                                              |
| Sessions             | `COUNT(DISTINCT AnalyticsEvent.sessionId)`                                                                                                              |
| Views                | Count of `page_view`, `smart_page_view`, `smart_card_view`, and `product_view`                                                                          |
| Clicks               | Count of valid click events: `link_click`, `button_click`, `social_click`, `whatsapp_click`, `product_click`, `website_click`, and `save_contact_click` |
| WhatsApp clicks      | Count of `whatsapp_click`; this does not represent a conversation or lead                                                                               |
| Conversions          | `COUNT(AnalyticsConversion)` produced by the Goal Engine                                                                                                |
| CVR                  | `conversions / unique visitors` in the same selected scope                                                                                              |
| Content interactions | `clicks + qr_scan` for the displayed asset                                                                                                              |

CVR can exceed 100% when one visitor completes more than one conversion. A
`page_view` is not a visitor, a click is not a conversion, and a `qr_scan` or
`whatsapp_click` becomes a conversion only when a matching Goal creates an
`AnalyticsConversion` record.

## Aggregation API

`GET /api/workspace/analytics` accepts `view` and shared filters:

- `view=overview`: KPIs, optional comparison, and WhatsApp clicks.
- `view=timeseries`: daily Visitors, Views, Clicks, and Conversions.
- `view=sources` and `view=channels`: acquisition dimensions.
- `view=assets`: named Smart Pages, Smart Cards, Links, and QR Codes.
- `view=campaigns`: campaigns with observed activity only.
- `view=goals`: Goal performance, configured Goal options, and primary Goal.
- `view=utms`: `utm_source`, `utm_medium`, and `utm_campaign` values observed
  on recorded events.
- `view=journeys`: conversion-backed session paths, source/campaign/asset
  summaries, and options for Journey filters.

Shared filters are `period` (`7d`, `30d`, `90d`), `from`, `to`, `assetType`,
`assetId`, `campaignId`, `goalId`, `source`, and `channel`. The dashboard keeps
the user-facing filters in its URL as `period`, `assetType`, `asset`,
`campaign`, and `goal`, so a view can be reloaded or shared.

All endpoint handlers obtain the actor through `requireActor()`. Query builders
always apply `workspaceId`, bot/test exclusion, and selected dimensions before
counting. Existing indexes cover workspace/date, event/date, asset/date,
campaign/date, goal/date, and source/date paths. The event collector also
maintains `AnalyticsAggregate` buckets for future read-path rollups; V1 uses
database aggregation queries while volume remains small.

## Time And Attribution

The selected period is resolved server-side in `Workspace.timezone`; raw event
timestamps are grouped by local calendar day using PostgreSQL `AT TIME ZONE`.
The UI sends a period token rather than deriving date boundaries in the browser.

Source, medium, channel, UTM, campaign, asset, and conversion attribution come
from the data recorded by `recordAnalyticsEvent()` and `GoalEngine`. Attribution
remains deterministic: explicit UTM, recognized referrer, server QR context,
trusted first-party context, then referral or `direct`. Direct traffic is shown
as `Direct`; no origin is fabricated.

## Journey V1

`/analytics/journey` redirects to the authenticated
`/untrack/analytics/journey` view, preserving scalar URL filters. The Journey
uses Last Touch in V1 and clearly labels that attribution choice in the UI.
When an active Primary Goal exists, it is the default conversion scope; an
explicit `goal` URL filter overrides it.

The backend first loads `AnalyticsConversion` records scoped to the actor's
workspace, selected period, and filters. It then loads ordered
`AnalyticsEvent` records only from the same `sessionId` values. A path contains
the real source, campaign when `campaignId` is present, a supported asset
(Smart Page, Smart Card, Link, or QR Code), the final supported interaction,
and the Goal-backed conversion. QR scans retain the QR asset name/context as
the source when that event is present. Missing levels are omitted; no inferred
campaign, asset, source, or cross-session stitching is introduced.

The response contains aggregated paths plus Source, Campaign, and Asset
conversion summaries. It never returns visitor IDs, session IDs, names, email
addresses, phones, or raw events to the browser. Visitors are distinct
pseudonymous IDs within each aggregate, sessions are distinct session IDs, and
CVR uses the shared `conversionRate()` definition. Paths after the first five
are visually collapsed as “Outras jornadas” only in the UI; the API retains
the full aggregate response. To bound the initial query path, V1 marks a
response as sampled at 2,000 conversions or 10,000 loaded events.

Journey uses the existing `advancedAnalytics` entitlement. Free collection is
never affected; the complete visualization is gated through `PremiumGate`, and
Trial inherits Premium access through Account Access.

## Access And States

- Free retains collection and receives seven days of useful overview, top
  sources, and top content. It can see the official 7-day history limit.
- Trial has effective Premium access through the existing Account Access
  Service. When the trial expires, collected data remains and visibility returns
  to Free limits.
- Premium uses the existing entitlement for up to 365 days, comparison, full
  channels, and extended breakdowns. Selecting unavailable 30/90-day history
  uses `PremiumGate`; collection is never disabled.

The dashboard uses local skeletons while aggregates load and an explicit retry
state for failures. No empty chart is shown for a workspace without data. A
workspace with visits but no configured Goals receives a CTA to create a Goal.
No visitor PII is rendered.

## Scope Boundaries

V1 deliberately does not implement Audience, session replay, heatmaps, AI
insights, revenue attribution, predictive journeys, advanced multi-touch
attribution, cross-device stitching, real-time processing, or exports. It does
not treat a WhatsApp click, form submit, or QR scan as a conversion unless the
Goal Engine has created an `AnalyticsConversion` record.

## Verification

Focused coverage is in `tests/unit/analytics-queries.test.ts`, including
workspace scoping, Goal conversion aggregation, a structured session Journey,
and timezone-bucketed daily series. Run:

```bash
npm test -- tests/unit/analytics-queries.test.ts
npm run lint
npx tsc --noEmit
npm test
npm run build
```
