# Universal Event Tracking

This document describes the LinkOr event-tracking foundation. It is a
collection and attribution layer for public assets, not a Journey, Audience, or
analytics dashboard implementation.

## Architecture

```text
Public asset or redirect
  -> browser SDK / tracked redirect
  -> asset-specific public route
  -> recordAnalyticsEvent()
  -> AnalyticsEvent, AnalyticsVisitor, AnalyticsSession
  -> aggregates, goals, analytics queries
```

`recordAnalyticsEvent()` in `modules/analytics/service.ts` is the only writer
for universal events. Public routes resolve the asset first and derive its
workspace on the server. Browser payloads never choose a workspace or campaign
ID.

Tracked entry points are:

- Smart Pages: `POST /api/smart-pages/events`
- Smart Cards: `POST /api/smart-cards/events`
- Short links: `/s/:slug`
- Dynamic QR codes: `/q/:slug`
- WhatsApp links: `/w/:slug`

Redirects set first-party context before returning `302`; event persistence is
scheduled after the response. A storage failure therefore does not make a link
unusable.

## Taxonomy And Context

`AnalyticsEvents` in `modules/analytics/event-types.ts` is the central
registry. Event names use snake_case. The foundation supports:

- Views: `page_view`, `smart_page_view`, `smart_card_view`, `product_view`
- Interactions: `link_click`, `button_click`, `social_click`,
  `whatsapp_click`, `website_click`, `save_contact_click`, `qr_scan`
- Forms and conversion: `form_view`, `form_submit`, `lead_created`,
  `goal_completed`
- Future commerce: `checkout_view`, `checkout_started`, `payment_completed`

Every event can carry workspace, pseudonymous visitor/session, asset, element,
campaign, destination, attribution, device, bot, test-mode, and optional
authenticated-user context. The event store also supports an internal contact
foreign key only after voluntary form consent; it never stores contact data in
event metadata.

The supported asset types are `smart_page`, `smart_card`, `link`, `qr_code`,
`campaign`, `product`, and the reserved `payment_link`.

## Identity, Sessions, And Attribution

The browser SDK owns opaque UUIDs only. It persists a first-party visitor ID
and a session ID in browser storage and cookies. Redirects use the same
first-party cookie names, so QR/link entries and the next public-page event can
share a visitor/session. IDs are hashed before storage in the database.

The server refuses to create or continue persistent analytics identity when
the request has `DNT: 1` or `Sec-GPC: 1`. Contact capture remains available
when explicit form consent is present, but no analytics event is linked in that
case.

Session timeout is centralized by `ANALYTICS_SESSION_TIMEOUT_MINUTES`
(default 30, minimum 5, maximum 240). Visitors retain first touch and last
touch source, medium, channel, campaign, and timestamp. Sessions retain the
landing page, initial referrer, source, medium, channel, and campaign.

Attribution is deterministic:

1. Explicit UTM values.
2. A recognized referrer.
3. Server-resolved QR context.
4. A prior signed first-party context for the current session.
5. Unrecognized referral or direct traffic.

Known sources are Google, Bing, Instagram, Facebook, LinkedIn, YouTube,
TikTok, X, and WhatsApp. Channels are direct, organic/paid search,
organic/paid social, email, messaging, referral, QR, and other. LinkOr does
not invent an unknown source.

The context cookie is HMAC-signed with `BETTER_AUTH_SECRET`, short lived, and
contains only limited attribution/campaign/QR context. It is not a contact
identifier and carries no PII.

## QR, Links, And WhatsApp

Dynamic QR assets point to `/q/:slug`. A QR scan records `qr_scan` with the QR
asset ID, optional campaign ID, and optional `QrAsset.context` such as
`event_stand`. Context is created through the QR service but does not require a
new UI field to be useful.

Links and WhatsApp redirects use the same collector. `whatsapp_click` means
the user selected the CTA or redirect; it never means a message was sent or a
conversation happened. Smart Page WhatsApp blocks and Smart Card WhatsApp
actions emit that same canonical event.

## Goals And Conversions

Goals turn a user-selected event into a result without changing the event
itself:

```text
AnalyticsEvent -> GoalEngine -> AnalyticsConversion -> Analytics queries
```

`AnalyticsGoal` is workspace-scoped and stores a friendly name, type, event
name, status, scope, optional simple conditions, and whether it is the primary
goal for that scope. V1 supports `LINK_CLICK`, `WHATSAPP_CLICK`,
`FORM_SUBMIT`, `LEAD_CREATED`, `QR_SCAN`, `PAGE_VIEW`, and `BUTTON_CLICK`.
Future commerce types are intentionally not accepted by the creation API.

Goals can apply to a whole workspace, one campaign, one asset, or one element.
Conditions are internal JSON limited to `assetType`, `elementType`, and
`elementId`; the V1 UI exposes only compatible asset/campaign choices. Every
scope is resolved against the current workspace before a Goal can be saved.

`GoalEngine` runs inside the transaction that persists a source event. It only
queries active Goals indexed by workspace, status, and event name, then checks
scope and conditions. `goal_completed` is an internal analytics event for
compatibility, but it is ignored by the engine to prevent a completion loop.

Each `AnalyticsConversion` retains its source `AnalyticsEvent` foreign key,
Goal, visitor/session, campaign, asset, last-touch attribution, first-touch
attribution, date bucket, and test/bot markers. The unique pair
`goalId + eventId` makes retries idempotent. Archiving a Goal never deletes
these records; it only prevents future matches.

`whatsapp_click` can satisfy a WhatsApp-contact Goal only after the workspace
chooses that Goal. It does not imply a lead or a sent message. Likewise,
`qr_scan` can satisfy a QR Goal but does not imply a lead or sale. A submitted
form and a created lead remain separate events and Goal types.

Conversion rate uses one formula in overview, sources, channels, assets,
campaigns, and the Goal list:

```text
conversion rate = conversions / unique visitors in the same selected scope
```

`GET /api/workspace/analytics/goals` returns Goals and their scoped conversion
metrics. `GET /api/workspace/analytics/conversions` returns conversion records
with `from`, `to`, `goalId`, `campaignId`, `assetType`, `assetId`, `source`, and
`channel` filters. The general Analytics route supports the same common
filters and `view=campaigns` for campaign visitors, clicks, conversions, CVR,
and primary Goal.

## Security And Privacy

- Public asset routes resolve ownership by published slug/action/block on the
  server. They reject invalid blocks/actions rather than accepting IDs from the
  browser as authoritative.
- Event IDs are unique and retries are idempotent.
- Public endpoints use same-origin enforcement, Zod schemas, bounded values,
  rate-limit buckets, and metadata filtering.
- Metadata accepts at most 20 primitive keys and rejects common PII-like keys
  such as email, phone, WhatsApp, address, name, message, token, and password.
- URLs are normalized without query strings before storage where applicable.
- User agents are classified centrally into device, browser, OS, and obvious
  preview/crawler/automation bot categories; raw user agents are not stored.
- Geo fields exist in the schema but are intentionally not populated until a
  compliant server-side approximate-location provider is selected. IP addresses
  are not stored or fingerprinted.

Workspace isolation is enforced by server-side asset resolution and all private
analytics queries filter `workspaceId`. PostgreSQL row-level security is not
enabled in the current Prisma deployment model; do not add policies without a
per-request database-role design. Goal creation validates that every campaign,
asset, or element belongs to the actor workspace; GoalEngine also rejects a
candidate whose workspace differs from the source event.

## Operations

Raw data is purged by `purgeExpiredAnalytics()` according to
`ANALYTICS_RETENTION_DAYS` (default 365). Aggregate data is independent from
raw event retention.

Set `ANALYTICS_TEST_MODE=true` to store events with `isTest=true`. These events
are excluded from aggregates and standard analytics queries, so a test does not
contaminate production metrics. The collector is independent from plan checks:
collection happens for Free, Trial, and Premium workspaces; plan entitlements
only limit analytics visibility.

## Current Limits

- No Journey UI, Audience UI, payment collection, attribution model, session
  replay, or heatmap is part of this foundation.
- Form-to-lead analytics is implemented for consented Smart Card contact forms.
  Smart Page form blocks are not present yet.
- First-party cookies cannot follow a redirect from a custom domain to a public
  asset on a different registrable domain. Platform-hosted QR/link journeys are
  continuous; cross-domain propagation needs an explicit future handoff design.
- Event-health counters are not yet exported to a metrics backend. Rate-limit,
  validation, and collector failures remain observable through structured
  server logs.

## Verification

Focused unit coverage includes UTM/referrer/QR attribution, bot/device
classification, session reuse/expiry, idempotency, signed context, QR
redirects, Smart Page context propagation, Smart Page WhatsApp clicks, Smart
Card events, and scoped Goal completion for WhatsApp, QR, duplicate events,
paused Goals, attribution, and cross-workspace isolation.

Run:

```bash
npm run prisma:generate
npm test -- tests/unit/analytics-foundation.test.ts tests/unit/analytics-service.test.ts tests/unit/analytics-public-context.test.ts tests/unit/redirect-tracking.test.ts tests/unit/smart-page-events.test.ts tests/unit/smart-cards.test.ts
```
