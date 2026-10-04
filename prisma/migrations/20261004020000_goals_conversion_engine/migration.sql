-- Goals become user-defined conversion rules. Existing goal history remains intact.
CREATE TYPE "AnalyticsGoalType" AS ENUM (
  'LINK_CLICK',
  'WHATSAPP_CLICK',
  'FORM_SUBMIT',
  'LEAD_CREATED',
  'QR_SCAN',
  'PAGE_VIEW',
  'BUTTON_CLICK'
);

CREATE TYPE "AnalyticsGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AnalyticsGoalScopeType" AS ENUM ('WORKSPACE', 'CAMPAIGN', 'ASSET', 'ELEMENT');

ALTER TABLE "AnalyticsGoal"
  ADD COLUMN "goalType" "AnalyticsGoalType",
  ADD COLUMN "status" "AnalyticsGoalStatus",
  ADD COLUMN "scopeType" "AnalyticsGoalScopeType",
  ADD COLUMN "scopeId" VARCHAR(255),
  ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AnalyticsGoal"
SET
  "goalType" = CASE "eventName"
    WHEN 'whatsapp_click' THEN 'WHATSAPP_CLICK'::"AnalyticsGoalType"
    WHEN 'form_submit' THEN 'FORM_SUBMIT'::"AnalyticsGoalType"
    WHEN 'lead_created' THEN 'LEAD_CREATED'::"AnalyticsGoalType"
    WHEN 'qr_scan' THEN 'QR_SCAN'::"AnalyticsGoalType"
    WHEN 'smart_page_view' THEN 'PAGE_VIEW'::"AnalyticsGoalType"
    WHEN 'page_view' THEN 'PAGE_VIEW'::"AnalyticsGoalType"
    WHEN 'button_click' THEN 'BUTTON_CLICK'::"AnalyticsGoalType"
    ELSE 'LINK_CLICK'::"AnalyticsGoalType"
  END,
  "status" = CASE WHEN "active" THEN 'ACTIVE'::"AnalyticsGoalStatus" ELSE 'PAUSED'::"AnalyticsGoalStatus" END,
  "scopeType" = CASE WHEN "assetId" IS NULL THEN 'WORKSPACE'::"AnalyticsGoalScopeType" ELSE 'ASSET'::"AnalyticsGoalScopeType" END,
  "scopeId" = "assetId",
  "conditions" = CASE
    WHEN "assetType" IS NULL THEN '{}'::jsonb
    ELSE jsonb_build_object('assetType', "assetType")
  END;

ALTER TABLE "AnalyticsGoal"
  ALTER COLUMN "goalType" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "scopeType" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "scopeType" SET DEFAULT 'WORKSPACE';

DROP INDEX "AnalyticsGoal_workspaceId_active_eventName_idx";
ALTER TABLE "AnalyticsGoal"
  DROP COLUMN "assetType",
  DROP COLUMN "assetId",
  DROP COLUMN "active";

CREATE INDEX "AnalyticsGoal_workspaceId_status_eventName_idx"
  ON "AnalyticsGoal"("workspaceId", "status", "eventName");
CREATE INDEX "AnalyticsGoal_workspaceId_scopeType_scopeId_idx"
  ON "AnalyticsGoal"("workspaceId", "scopeType", "scopeId");
CREATE UNIQUE INDEX "AnalyticsGoal_one_primary_per_scope_key"
  ON "AnalyticsGoal"("workspaceId", "scopeType", COALESCE("scopeId", ''))
  WHERE "isPrimary" AND "status" <> 'ARCHIVED';

INSERT INTO "WorkspaceUsage" ("workspaceId", "resource", "count")
SELECT "workspaceId", 'goals', COUNT(*)::INTEGER
FROM "AnalyticsGoal"
WHERE "status" <> 'ARCHIVED'
GROUP BY "workspaceId"
ON CONFLICT ("workspaceId", "resource")
DO UPDATE SET "count" = EXCLUDED."count";

ALTER TABLE "AnalyticsGoalEvent" RENAME TO "AnalyticsConversion";
ALTER TABLE "AnalyticsConversion" RENAME CONSTRAINT "AnalyticsGoalEvent_pkey" TO "AnalyticsConversion_pkey";
ALTER TABLE "AnalyticsConversion" RENAME CONSTRAINT "AnalyticsGoalEvent_workspaceId_fkey" TO "AnalyticsConversion_workspaceId_fkey";
ALTER TABLE "AnalyticsConversion" RENAME CONSTRAINT "AnalyticsGoalEvent_goalId_fkey" TO "AnalyticsConversion_goalId_fkey";
ALTER TABLE "AnalyticsConversion" RENAME CONSTRAINT "AnalyticsGoalEvent_eventId_fkey" TO "AnalyticsConversion_eventId_fkey";
ALTER TABLE "AnalyticsConversion" RENAME CONSTRAINT "AnalyticsGoalEvent_visitorId_fkey" TO "AnalyticsConversion_visitorId_fkey";
ALTER TABLE "AnalyticsConversion" RENAME CONSTRAINT "AnalyticsGoalEvent_sessionId_fkey" TO "AnalyticsConversion_sessionId_fkey";
ALTER INDEX "AnalyticsGoalEvent_goalId_eventId_key" RENAME TO "AnalyticsConversion_goalId_eventId_key";
ALTER INDEX "AnalyticsGoalEvent_workspaceId_occurredAt_idx" RENAME TO "AnalyticsConversion_workspaceId_occurredAt_idx";
ALTER INDEX "AnalyticsGoalEvent_goalId_occurredAt_idx" RENAME TO "AnalyticsConversion_goalId_occurredAt_idx";
ALTER INDEX "AnalyticsGoalEvent_visitorId_occurredAt_idx" RENAME TO "AnalyticsConversion_visitorId_occurredAt_idx";
ALTER INDEX "AnalyticsGoalEvent_sessionId_occurredAt_idx" RENAME TO "AnalyticsConversion_sessionId_occurredAt_idx";

ALTER TABLE "AnalyticsConversion"
  ADD COLUMN "source" VARCHAR(253),
  ADD COLUMN "medium" VARCHAR(120),
  ADD COLUMN "channel" VARCHAR(40),
  ADD COLUMN "firstTouchSource" VARCHAR(253),
  ADD COLUMN "firstTouchMedium" VARCHAR(120),
  ADD COLUMN "firstTouchChannel" VARCHAR(40),
  ADD COLUMN "firstTouchCampaign" VARCHAR(120),
  ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "day" DATE,
  ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AnalyticsConversion" AS conversion
SET
  "day" = event."day",
  "isBot" = event."isBot",
  "isTest" = event."isTest"
FROM "AnalyticsEvent" AS event
WHERE event."id" = conversion."eventId";

CREATE INDEX "AnalyticsConversion_workspaceId_source_occurredAt_idx"
  ON "AnalyticsConversion"("workspaceId", "source", "occurredAt");
CREATE INDEX "AnalyticsConversion_workspaceId_campaignId_occurredAt_idx"
  ON "AnalyticsConversion"("workspaceId", "campaignId", "occurredAt");
CREATE INDEX "AnalyticsConversion_workspaceId_day_idx"
  ON "AnalyticsConversion"("workspaceId", "day");