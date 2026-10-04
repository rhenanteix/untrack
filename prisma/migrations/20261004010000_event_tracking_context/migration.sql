ALTER TABLE "AnalyticsEvent"
  ADD COLUMN "userId" TEXT,
  ADD COLUMN "goalId" TEXT,
  ADD COLUMN "audienceContactId" TEXT;

ALTER TABLE "AnalyticsVisitor"
  ADD COLUMN "firstTouchChannel" VARCHAR(40),
  ADD COLUMN "lastTouchSource" VARCHAR(253),
  ADD COLUMN "lastTouchMedium" VARCHAR(120),
  ADD COLUMN "lastTouchChannel" VARCHAR(40),
  ADD COLUMN "lastTouchCampaign" VARCHAR(120),
  ADD COLUMN "lastTouchAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AnalyticsSession"
  ADD COLUMN "initialChannel" VARCHAR(40);

ALTER TABLE "AnalyticsEvent"
  ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "QrAsset"
  ADD COLUMN "context" VARCHAR(80);

CREATE INDEX "AnalyticsEvent_goalId_occurredAt_idx" ON "AnalyticsEvent"("goalId", "occurredAt");
CREATE INDEX "AnalyticsEvent_userId_occurredAt_idx" ON "AnalyticsEvent"("userId", "occurredAt");
CREATE INDEX "AnalyticsEvent_audienceContactId_occurredAt_idx" ON "AnalyticsEvent"("audienceContactId", "occurredAt");
CREATE INDEX "AnalyticsEvent_workspaceId_isTest_occurredAt_idx" ON "AnalyticsEvent"("workspaceId", "isTest", "occurredAt");

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "AnalyticsGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
  ADD CONSTRAINT "AnalyticsEvent_audienceContactId_fkey"
  FOREIGN KEY ("audienceContactId") REFERENCES "AudienceContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;