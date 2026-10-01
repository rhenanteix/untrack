# Smart Pages - Phase 6

Smart Pages add a public, mobile-first profile page to a workspace without
replacing the existing ShortLink, UTM, QR, campaign, or analytics domains.

## Scope delivered

- create, edit, publish, and unpublish a page;
- public route at `/page/[slug]` with dynamic metadata and social previews;
- profile title, bio, external avatar URL, and globally unique slug;
- ordered Link Blocks with a validated external destination or a workspace
  ShortLink reference;
- live editor preview, managed-link selection, visibility, new-tab behavior,
  click tracking, and page metrics;
- workspace roles, quotas, audit events, same-origin mutation checks, rate
  limits, and tenant isolation.

The Phase 6 block contract is intentionally extensible:

```ts
{
  id: string;
  type: string;
  position: number;
  settings: Json;
  visible: boolean;
  analyticsEnabled: boolean;
}
```

Only `link` is accepted by the API in this phase. Phase 7 expands block types,
appearance, themes, and scheduling. Campaign overrides, routing, experiments,
monitoring, and AI are not activated by Smart Pages.

## Data model

`SmartPage` belongs to `Workspace`; its public slug is unique. `SmartPageBlock`
belongs to its page and can reference `ShortLink`. The service checks the
workspace before accepting that reference, so a block cannot link to an asset
owned by another tenant.

The `smartPages` usage resource is centralized in `PLAN_LIMITS`:

| Plan     | Smart Pages |
| -------- | ----------: |
| free     |           1 |
| pro      |          10 |
| business |         100 |

Apply `prisma/migrations/20260930030000_smart_pages` using the normal deploy
command. It also extends the existing `AnalyticsEvent` table; it does not
create a second analytics system.

## APIs

Authenticated workspace APIs:

- `GET`, `POST /api/smart-pages`
- `GET`, `PATCH`, `DELETE /api/smart-pages/[id]`
- `POST /api/smart-pages/[id]/publish` with `{ "published": boolean }`
- `POST`, `PATCH /api/smart-pages/[id]/blocks`
- `PATCH`, `DELETE /api/smart-pages/[id]/blocks/[blockId]`
- `GET /api/smart-pages/[id]/analytics?days=30`

The public `POST /api/smart-pages/events` accepts only the page and block event
names registered in `lib/analytics-events.ts`. It resolves the published page
and visible analytics-enabled block server-side instead of trusting a client
page ID or workspace ID.

## Privacy and analytics

Smart Page analytics stores the event timestamp, UTC day, referrer hostname,
coarse device category, page/block dimensions, and a server-salted SHA-256 hash
of a browser session ID. It never stores IP address, raw user agent, full
referrer URL, query string, account cookie, or submitted destination URL.
Known preview bots and prefetches are ignored using the same policy as short
link clicks. Unique visitors are unique browser sessions, not a claim of unique
people.

## Validation

```bash
npm test -- tests/unit/smart-pages.test.ts tests/unit/smart-page-events.test.ts
npm run test:e2e -- tests/e2e/smart-pages.spec.ts
npm run lint
npm run build
```

E2E requires `TEST_DATABASE_URL`, with a database name ending in `_test`, as
documented for the existing V2 suite.
