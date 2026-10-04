# Account Access

## Ownership

The current LinkOr commercial model is account-owned:

```text
User -> Plan -> Subscription -> Trial -> AccountAccess -> Entitlements
User -> Workspace -> Assets, usage counters, membership and tenant isolation
```

`Workspace` does not have a plan field. Selecting a different workspace never
changes the access of the signed-in user.

## Access Model

- `Plan` is `free` or `premium`; new `User` rows default to `free` in PostgreSQL.
- `UserTrial` is independent of the plan. It can be `none`, `active`, `expired`
  or `cancelled` and stores UTC `startedAt`, `expiresAt` and `usedAt` timestamps.
- `UserSubscription` is reserved for a future trusted payment webhook. No route
  creates subscriptions or promotes an account to Premium today.
- `getAccountAccess()` is the source of truth. A paid Premium account wins;
  otherwise only an unexpired active trial produces effective Premium access.
- Expiry is checked against the timestamp on every access resolution. A job may
  persist `expired` and emit analytics later, but it is never required to revoke
  effective Premium access.

Trial duration is exactly 30 times 24 hours from the server timestamp. Starting
a trial locks the user row, writes `usedAt` immediately and rejects any later
attempt, including after expiry or cancellation.

## Enforcement and Downgrade

`workspaceTransaction()` locks the member's user row and resolves
`AccountAccess` before every protected write. `reserveQuota`, `canUse`,
`getLimit`, `getAnalyticsHistoryDays` and `requirePremium` receive that effective
access, never a workspace plan.

Usage remains scoped to a workspace. Existing assets are never deleted when a
trial expires or a paid account is later downgraded. The existing quota behavior
continues to block new creations above Free limits while leaving reads, edits,
deletions and published assets intact. Historical analytics data and audience
contacts remain stored; only the visible Free entitlement is reapplied.

## Security and RLS

This Prisma/PostgreSQL deployment has no database RLS policies or direct
browser database access. Authorization is enforced by HttpOnly Better Auth
sessions, `Actor` membership checks, role checks, same-origin checks, rate
limits and server-side Prisma queries. The client cannot submit `plan`, trial
status or trial dates to any account mutation schema. The only trial mutation
endpoint has no privilege payload and calls the transaction-protected service.

If the application later adds Supabase/PostgREST or another direct database
client, equivalent RLS policies must be introduced before exposing these tables.

## Legacy Migration

Migration `20261004000000_user_account_access` assigns every existing and new
user `free` by default. Before dropping `Workspace.plan`, it writes one
`billing.workspace_plan_legacy_detected` audit record per legacy Premium
workspace, including whether an owner/member could be identified. No owner or
member is promoted automatically. Review those audit records and use a trusted
internal subscription workflow for any intentional Premium grant.