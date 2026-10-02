ALTER TABLE "AnalyticsEvent"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "origin" VARCHAR(16) NOT NULL DEFAULT 'server',
  ADD COLUMN "visitorId" TEXT,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "assetType" VARCHAR(40),
  ADD COLUMN "assetId" VARCHAR(255),
  ADD COLUMN "elementType" VARCHAR(40),
  ADD COLUMN "elementId" VARCHAR(255),
  ADD COLUMN "campaignId" VARCHAR(255),
  ADD COLUMN "path" VARCHAR(2048),
  ADD COLUMN "destinationUrl" VARCHAR(4096),
  ADD COLUMN "source" VARCHAR(253),
  ADD COLUMN "medium" VARCHAR(120),
  ADD COLUMN "channel" VARCHAR(40),
  ADD COLUMN "utmSource" VARCHAR(120),
  ADD COLUMN "utmMedium" VARCHAR(120),
  ADD COLUMN "utmCampaign" VARCHAR(120),
  ADD COLUMN "utmContent" VARCHAR(120),
  ADD COLUMN "utmTerm" VARCHAR(120),
  ADD COLUMN "country" VARCHAR(2),
  ADD COLUMN "region" VARCHAR(120),
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "timezone" VARCHAR(80),
  ADD COLUMN "deviceType" VARCHAR(20),
  ADD COLUMN "os" VARCHAR(20),
  ADD COLUMN "browser" VARCHAR(20),
  ADD COLUMN "isBot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "botType" VARCHAR(20);

UPDATE "AnalyticsEvent" SET "eventId" = "id" WHERE "eventId" IS NULL;
ALTER TABLE "AnalyticsEvent" ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "AnalyticsEvent" ALTER COLUMN "metadata" SET DEFAULT '{}';

CREATE UNIQUE INDEX "AnalyticsEvent_eventId_key" ON "AnalyticsEvent"("eventId");
CREATE INDEX "AnalyticsEvent_workspaceId_occurredAt_idx" ON "AnalyticsEvent"("workspaceId", "occurredAt");
CREATE INDEX "AnalyticsEvent_workspaceId_name_occurredAt_idx" ON "AnalyticsEvent"("workspaceId", "name", "occurredAt");
CREATE INDEX "AnalyticsEvent_assetId_occurredAt_idx" ON "AnalyticsEvent"("assetId", "occurredAt");
CREATE INDEX "AnalyticsEvent_campaignId_occurredAt_idx" ON "AnalyticsEvent"("campaignId", "occurredAt");
CREATE INDEX "AnalyticsEvent_visitorId_occurredAt_idx" ON "AnalyticsEvent"("visitorId", "occurredAt");
CREATE INDEX "AnalyticsEvent_sessionId_occurredAt_idx" ON "AnalyticsEvent"("sessionId", "occurredAt");

CREATE TABLE "AnalyticsVisitor" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "visitorHash" VARCHAR(64) NOT NULL,
  "firstTouchSource" VARCHAR(253),
  "firstTouchMedium" VARCHAR(120),
  "firstTouchCampaign" VARCHAR(120),
  "firstTouchAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsVisitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsSession" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "sessionHash" VARCHAR(64) NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "landingPage" VARCHAR(2048),
  "entryReferrer" VARCHAR(253),
  "initialSource" VARCHAR(253),
  "initialMedium" VARCHAR(120),
  "initialCampaign" VARCHAR(120),
  CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsGoal" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "eventName" VARCHAR(80) NOT NULL,
  "assetType" VARCHAR(40),
  "assetId" VARCHAR(255),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalyticsGoalEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "goalId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "visitorId" TEXT,
  "sessionId" TEXT,
  "assetType" VARCHAR(40),
  "assetId" VARCHAR(255),
  "campaignId" VARCHAR(255),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsGoalEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsVisitor_workspaceId_visitorHash_key" ON "AnalyticsVisitor"("workspaceId", "visitorHash");
CREATE INDEX "AnalyticsVisitor_workspaceId_lastSeenAt_idx" ON "AnalyticsVisitor"("workspaceId", "lastSeenAt");
CREATE INDEX "AnalyticsSession_workspaceId_sessionHash_lastActivityAt_idx" ON "AnalyticsSession"("workspaceId", "sessionHash", "lastActivityAt");
CREATE INDEX "AnalyticsSession_visitorId_startedAt_idx" ON "AnalyticsSession"("visitorId", "startedAt");
CREATE UNIQUE INDEX "AnalyticsGoal_workspaceId_name_key" ON "AnalyticsGoal"("workspaceId", "name");
CREATE INDEX "AnalyticsGoal_workspaceId_active_eventName_idx" ON "AnalyticsGoal"("workspaceId", "active", "eventName");
CREATE UNIQUE INDEX "AnalyticsGoalEvent_goalId_eventId_key" ON "AnalyticsGoalEvent"("goalId", "eventId");
CREATE INDEX "AnalyticsGoalEvent_workspaceId_occurredAt_idx" ON "AnalyticsGoalEvent"("workspaceId", "occurredAt");
CREATE INDEX "AnalyticsGoalEvent_goalId_occurredAt_idx" ON "AnalyticsGoalEvent"("goalId", "occurredAt");
CREATE INDEX "AnalyticsGoalEvent_visitorId_occurredAt_idx" ON "AnalyticsGoalEvent"("visitorId", "occurredAt");
CREATE INDEX "AnalyticsGoalEvent_sessionId_occurredAt_idx" ON "AnalyticsGoalEvent"("sessionId", "occurredAt");

ALTER TABLE "AnalyticsVisitor" ADD CONSTRAINT "AnalyticsVisitor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSession" ADD CONSTRAINT "AnalyticsSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsSession" ADD CONSTRAINT "AnalyticsSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoal" ADD CONSTRAINT "AnalyticsGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoalEvent" ADD CONSTRAINT "AnalyticsGoalEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoalEvent" ADD CONSTRAINT "AnalyticsGoalEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "AnalyticsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoalEvent" ADD CONSTRAINT "AnalyticsGoalEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AnalyticsEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoalEvent" ADD CONSTRAINT "AnalyticsGoalEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsGoalEvent" ADD CONSTRAINT "AnalyticsGoalEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;