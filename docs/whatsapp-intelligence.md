# WhatsApp Intelligence

## Architecture

WhatsApp Intelligence is a workspace-scoped resource that stores a canonical
phone number, message, tracking configuration and lifecycle state. It does not
own a redirect, QR renderer, UTM builder, campaign or analytics database.

```text
WhatsAppLink -> ShortLink (/w/:slug) -> wa.me destination
      |              |                    |
      |              |                    +-- WhatsApp opens
      |              +-- LinkClick + AnalyticsEvent
      +-- Campaign, ProjectResource, QrAsset and UtmLink references
```

The public destination is generated only from the persisted normalized phone
number and message. Incoming redirect parameters are never used to choose a
destination.

## Reused Services

- `modules/workspaces/context.ts`: actor resolution, permission checks,
  transactions, quotas and audit trail.
- `modules/link-management`: persisted redirects and click collection.
- `modules/untrack-utm`: governed UTM creation and workspace policy.
- `modules/untrack-qr`: dynamic QR assets that target the WhatsApp smart link.
- `modules/campaigns`: existing campaigns and campaign channels.
- `ProjectResource`, `ResourceTag` and `Favorite`: project organization, tags
  and favorites without parallel relations.
- `lib/analytics.ts` and `AnalyticsEvent`: product events; `LinkClick` remains
  the source of truth for WhatsApp link clicks.

## New Entities

- `WhatsAppLink`: workspace resource with `DRAFT`, `ACTIVE` and `ARCHIVED`
  state; canonical phone, message, optional campaign and its smart-link ID.
- `WhatsAppTemplate`: workspace-scoped reusable message template. Templates,
  score recommendations and optimization follow the MVP rather than duplicating
  campaign data.
- New `whatsappLink` values in project and workspace resource type enums so the
  existing project, tag, favorite and global-resource facilities can own it.

## APIs

- `GET` and `POST /api/whatsapp/links`
- `GET`, `PATCH` and `DELETE /api/whatsapp/links/:id`
- `POST /api/whatsapp/links/:id/test`
- `POST /api/whatsapp/links/:id/qr`
- `POST /api/whatsapp/links/:id/utm`
- `GET` and `POST /api/whatsapp/templates`
- `GET /w/:slug` and `HEAD /w/:slug` for the public smart link

All private endpoints require an actor, same-origin mutations and a dedicated
rate-limit bucket. Reads and writes always scope records to the actor's
workspace; inaccessible records return 404.

## Integration Contracts

The application layer depends on adapters for smart links, UTM, QR, analytics,
campaign lookup and monitoring. The first implementation adapts existing local
services. Smart Routing, AI and WhatsApp Business remain contracts only, so
they can be introduced without embedding provider calls in the module.

## Security Risks And Controls

- Normalize phone numbers to one E.164-like digits-only representation; this
  is syntactic validation and never asserts that the number has WhatsApp.
- Generate `wa.me` URLs using `URL` and `URLSearchParams`; never concatenate
  unencoded message text.
- Resolve only the four documented message variables by literal replacement;
  templates cannot execute expressions or code.
- The redirect resolves a persisted `ShortLink` with `distribution=whatsapp`.
  It ignores all incoming parameters and cannot become an open redirect.
- Tenant isolation is enforced by `workspaceId` in every private lookup;
  public links expose no configuration data.
- Preserve existing link click privacy: day, device category and referrer host
  only. Never collect conversation content or claim click counts are
  conversations.

## Migration Requirements

The migration adds WhatsApp links/templates, resource enum values and the
relation to the existing short-link table. It does not modify prior resources
or backfill user data. Deployment runs `npm run prisma:deploy` before enabling
`WHATSAPP_INTELLIGENCE=true`.

## Test Plan

- Unit: formatted phone normalization, invalid numbers, URL encoding (accent,
  emoji, whitespace, special characters, newlines, empty and long messages),
  variable interpolation and scoring.
- Integration: tenant-scoped create/read/update/archive, duplicate detection,
  campaign ownership, QR association and authorization errors.
- Public route: active link redirects to the persisted `wa.me` URL and records
  a click; invalid or archived slugs do not redirect.
- E2E: create, preview, copy, visit `/w/:slug`, generate a QR code and inspect
  click metrics. Campaign/UTM uses the existing governed services.

## Delivery Plan

1. Foundation: domain validation, URL builder, schema and feature gate.
2. Link Builder: private CRUD, preview, list and copy action.
3. Smart Link: public redirect, click analytics and QR integration.
4. Campaign and UTM: associate the existing campaign and governed tracking.
5. Progressive integrations: Smart Page CTA, templates, score and monitoring.
6. Hardening: tenant tests, abuse tests, E2E, documentation and rollout.
