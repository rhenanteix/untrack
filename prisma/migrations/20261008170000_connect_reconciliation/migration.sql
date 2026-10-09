-- Preserve globally unique legacy IDs while fencing the same logical native event
-- across legacy and Connect writers, including concurrent transactions.
ALTER TABLE "AnalyticsEvent" ADD COLUMN "connectOriginalEventId" VARCHAR(36);
CREATE UNIQUE INDEX "AnalyticsEvent_connect_reconciliation_key"
ON "AnalyticsEvent" ("workspaceId", (COALESCE("connectOriginalEventId", "eventId")))
WHERE "workspaceId" IS NOT NULL;
