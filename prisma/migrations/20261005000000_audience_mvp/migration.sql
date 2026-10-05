-- Audience augments the existing Contact domain; it does not create a second lead store.
CREATE TYPE "AudienceContactLifecycle" AS ENUM ('new', 'engaged', 'converted');
CREATE TYPE "AudienceEngagementLevel" AS ENUM ('low', 'medium', 'high');

ALTER TABLE "AudienceContact"
  ADD COLUMN "creationSource" VARCHAR(40) NOT NULL DEFAULT 'unknown',
  ADD COLUMN "firstSeenAt" TIMESTAMP(3),
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "audienceStatus" "AudienceContactLifecycle" NOT NULL DEFAULT 'new',
  ADD COLUMN "engagementLevel" "AudienceEngagementLevel" NOT NULL DEFAULT 'low',
  ADD COLUMN "conversionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "meaningfulInteractionCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "AudienceContact" AS contact
SET
  "creationSource" = CASE
    WHEN EXISTS (SELECT 1 FROM "SmartPageFormSubmission" submission WHERE submission."contactId" = contact.id) THEN 'form'
    WHEN EXISTS (SELECT 1 FROM "SmartCardContactExchange" exchange WHERE exchange."contactId" = contact.id) THEN 'smart_card_exchange'
    ELSE 'unknown'
  END,
  "firstSeenAt" = COALESCE(
    (SELECT MIN(event."occurredAt") FROM "AnalyticsEvent" event LEFT JOIN "AnalyticsVisitor" visitor ON visitor.id = event."visitorId" WHERE event."audienceContactId" = contact.id OR visitor."audienceContactId" = contact.id),
    (SELECT MIN(submission."submittedAt") FROM "SmartPageFormSubmission" submission WHERE submission."contactId" = contact.id),
    (SELECT MIN(exchange."capturedAt") FROM "SmartCardContactExchange" exchange WHERE exchange."contactId" = contact.id),
    contact."createdAt"
  ),
  "lastSeenAt" = COALESCE(
    (SELECT MAX(event."occurredAt") FROM "AnalyticsEvent" event LEFT JOIN "AnalyticsVisitor" visitor ON visitor.id = event."visitorId" WHERE event."audienceContactId" = contact.id OR visitor."audienceContactId" = contact.id),
    (SELECT MAX(submission."submittedAt") FROM "SmartPageFormSubmission" submission WHERE submission."contactId" = contact.id),
    (SELECT MAX(exchange."capturedAt") FROM "SmartCardContactExchange" exchange WHERE exchange."contactId" = contact.id),
    contact."updatedAt"
  ),
  "conversionCount" = (
    SELECT COUNT(*)::INTEGER FROM "AnalyticsConversion" conversion
    JOIN "AnalyticsVisitor" visitor ON visitor.id = conversion."visitorId"
    WHERE visitor."audienceContactId" = contact.id
  ),
  "meaningfulInteractionCount" = (
    SELECT COUNT(*)::INTEGER FROM "AnalyticsEvent" event
    LEFT JOIN "AnalyticsVisitor" visitor ON visitor.id = event."visitorId"
    WHERE (event."audienceContactId" = contact.id OR visitor."audienceContactId" = contact.id)
      AND event."isBot" = false
      AND event."isTest" = false
      AND event.name NOT IN ('form_submit', 'lead_created', 'goal_completed')
      AND event."occurredAt" > contact."createdAt"
  );

UPDATE "AudienceContact"
SET
  "audienceStatus" = CASE
    WHEN "conversionCount" > 0 THEN 'converted'::"AudienceContactLifecycle"
    WHEN "meaningfulInteractionCount" > 0 THEN 'engaged'::"AudienceContactLifecycle"
    ELSE 'new'::"AudienceContactLifecycle"
  END,
  "engagementLevel" = CASE
    WHEN "conversionCount" > 0 AND "meaningfulInteractionCount" > 0 THEN 'high'::"AudienceEngagementLevel"
    WHEN "meaningfulInteractionCount" >= 2 THEN 'medium'::"AudienceEngagementLevel"
    ELSE 'low'::"AudienceEngagementLevel"
  END,
  "firstSeenAt" = COALESCE("firstSeenAt", "createdAt"),
  "lastSeenAt" = COALESCE("lastSeenAt", "updatedAt");

ALTER TABLE "AudienceContact"
  ALTER COLUMN "firstSeenAt" SET NOT NULL,
  ALTER COLUMN "firstSeenAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "lastSeenAt" SET NOT NULL,
  ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AudienceContactTag" (
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AudienceContactTag_pkey" PRIMARY KEY ("contactId", "tagId")
);

CREATE TABLE "AudienceContactNote" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "content" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AudienceContactNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AudienceSegment" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "rules" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AudienceSegment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AudienceContact_id_workspaceId_key" ON "AudienceContact"("id", "workspaceId");
CREATE INDEX "AudienceContact_workspaceId_firstSource_idx" ON "AudienceContact"("workspaceId", "firstSource");
CREATE INDEX "AudienceContact_workspaceId_audienceStatus_lastSeenAt_idx" ON "AudienceContact"("workspaceId", "audienceStatus", "lastSeenAt");
CREATE INDEX "AudienceContact_workspaceId_engagementLevel_lastSeenAt_idx" ON "AudienceContact"("workspaceId", "engagementLevel", "lastSeenAt");
CREATE INDEX "AudienceContactTag_workspaceId_tagId_idx" ON "AudienceContactTag"("workspaceId", "tagId");
CREATE INDEX "AudienceContactNote_workspaceId_contactId_createdAt_idx" ON "AudienceContactNote"("workspaceId", "contactId", "createdAt");
CREATE UNIQUE INDEX "AudienceSegment_workspaceId_name_key" ON "AudienceSegment"("workspaceId", "name");
CREATE INDEX "AudienceSegment_workspaceId_updatedAt_idx" ON "AudienceSegment"("workspaceId", "updatedAt");

ALTER TABLE "AudienceContactTag"
  ADD CONSTRAINT "AudienceContactTag_contactId_workspaceId_fkey" FOREIGN KEY ("contactId", "workspaceId") REFERENCES "AudienceContact"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AudienceContactTag_tagId_workspaceId_fkey" FOREIGN KEY ("tagId", "workspaceId") REFERENCES "Tag"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudienceContactNote"
  ADD CONSTRAINT "AudienceContactNote_contactId_workspaceId_fkey" FOREIGN KEY ("contactId", "workspaceId") REFERENCES "AudienceContact"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AudienceContactNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AudienceSegment"
  ADD CONSTRAINT "AudienceSegment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;