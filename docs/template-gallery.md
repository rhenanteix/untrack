# Template gallery

Apply migrations with `npm run prisma:deploy`, then populate the catalog with
`npm run db:seed:templates`. The seed uses the configured `DATABASE_URL` and
creates six published templates across Criadores, Negócios and Portfólio (three
free, three premium). Re-running it preserves existing records, including edits
and publication status. Example links point to example.com and should be edited
before publishing a page.

Gallery interactions use the first-party `/api/analytics` endpoint. Events cover
opening, debounced search, category/plan filtering, clearing filters, previewing,
closing a preview, switching device, selecting, blocked premium selection,
loading more and starting from scratch. Search text is never included; catalog
slugs use the existing `source` field. Creation is recorded server-side only
after the transaction succeeds (`smart_page_created_from_template`). Persistence
uses the existing analytics configuration.

`tests/e2e/template-gallery.spec.ts` covers the browser-to-database creation flow,
interaction payloads, widths from 320 to 1440 pixels, keyboard preview access,
Escape dismissal and focus restoration. Existing Smart Pages tests also exercise
creation from scratch through the gallery. `tests/unit/template-seeds.test.ts`
validates seed content against application schemas and the client event allowlist.

For local Docker testing, use `127.0.0.1` in `TEST_DATABASE_URL` (Docker publishes
IPv4). A test-only `connection_limit=2` URL parameter avoids exhausting Postgres
connections when Next.js starts multiple development route workers.

## Verification (2026-10-08)

- Production build and TypeScript checks passed.
- ESLint passed with 0 errors and 8 warnings (including image optimization and a
  request-sequence ref warning in the new gallery).
- Unit tests: 55 files, 436 tests passed.
- Gallery E2E: desktop and mobile passed, including zero axe violations in the
  gallery, 320/390/768/1440px overflow checks, keyboard preview access, Escape and
  focus restoration, analytics payloads, and real draft creation.
- The older `smart-pages.spec.ts` suite stops at a stale signup expectation:
  it expects `/conta`, while the application redirects to `/onboarding?next=%2Fconta`.
  These results do not establish a clean pass for the entire E2E suite.
