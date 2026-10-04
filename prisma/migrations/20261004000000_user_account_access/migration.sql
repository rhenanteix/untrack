-- Plans, subscriptions and trials belong to users. Workspace data remains tenant-scoped.
CREATE TYPE "TrialStatus" AS ENUM ('none', 'active', 'expired', 'cancelled');

CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');

ALTER TABLE "User"
  ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'free';

CREATE TABLE "UserSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" "Plan" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
  "provider" VARCHAR(80),
  "providerCustomerId" VARCHAR(255),
  "providerSubscriptionId" VARCHAR(255),
  "startedAt" TIMESTAMPTZ(3),
  "currentPeriodEnd" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserTrial" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "TrialStatus" NOT NULL DEFAULT 'none',
  "startedAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3),
  "usedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserTrial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSubscription_providerSubscriptionId_key"
  ON "UserSubscription"("providerSubscriptionId");

CREATE INDEX "UserSubscription_userId_status_idx"
  ON "UserSubscription"("userId", "status");

CREATE UNIQUE INDEX "UserTrial_userId_key" ON "UserTrial"("userId");

CREATE INDEX "UserTrial_status_expiresAt_idx"
  ON "UserTrial"("status", "expiresAt");

ALTER TABLE "UserSubscription"
  ADD CONSTRAINT "UserSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTrial"
  ADD CONSTRAINT "UserTrial_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve a durable report of legacy workspace Premium assignments without
-- granting Premium to any member or owner.
INSERT INTO "AuditLog" ("id", "workspaceId", "actorId", "action", "entityId", "details", "createdAt")
SELECT
  CONCAT('workspace-plan-migration:', workspace."id"),
  workspace."id",
  COALESCE(actor."userId", 'system:workspace-plan-migration'),
  'billing.workspace_plan_legacy_detected',
  workspace."id",
  jsonb_build_object(
    'legacyPlan', workspace."plan"::text,
    'outcome', 'No user was promoted; review account subscription access explicitly.',
    'ownerFound', actor."userId" IS NOT NULL
  ),
  CURRENT_TIMESTAMP
FROM "Workspace" AS workspace
LEFT JOIN LATERAL (
  SELECT "userId"
  FROM "WorkspaceMember"
  WHERE "workspaceId" = workspace."id"
  ORDER BY CASE "role" WHEN 'owner' THEN 0 ELSE 1 END, "createdAt"
  LIMIT 1
) AS actor ON true
WHERE workspace."plan" = 'premium';

ALTER TABLE "Workspace" DROP COLUMN "plan";