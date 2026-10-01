BEGIN;

CREATE TYPE "SmartPageStatus" AS ENUM ('draft', 'published');

ALTER TABLE "AnalyticsEvent"
    ADD COLUMN "workspaceId" TEXT,
    ADD COLUMN "smartPageId" TEXT,
    ADD COLUMN "smartPageBlockId" TEXT,
    ADD COLUMN "day" DATE,
    ADD COLUMN "visitorHash" VARCHAR(64),
    ADD COLUMN "referrer" VARCHAR(253),
    ADD COLUMN "device" VARCHAR(20);

CREATE TABLE "SmartPage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "avatarUrl" VARCHAR(4096),
    "status" "SmartPageStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartPageBlock" (
    "id" TEXT NOT NULL,
    "smartPageId" TEXT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "position" INTEGER NOT NULL,
    "settings" JSONB NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "linkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartPageBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartPage_slug_key" ON "SmartPage"("slug");
CREATE INDEX "SmartPage_workspaceId_createdAt_idx" ON "SmartPage"("workspaceId", "createdAt");
CREATE INDEX "SmartPage_status_publishedAt_idx" ON "SmartPage"("status", "publishedAt");
CREATE UNIQUE INDEX "SmartPageBlock_smartPageId_position_key" ON "SmartPageBlock"("smartPageId", "position");
CREATE INDEX "SmartPageBlock_smartPageId_position_idx" ON "SmartPageBlock"("smartPageId", "position");
CREATE INDEX "SmartPageBlock_linkId_idx" ON "SmartPageBlock"("linkId");
CREATE INDEX "AnalyticsEvent_smartPageId_day_idx" ON "AnalyticsEvent"("smartPageId", "day");
CREATE INDEX "AnalyticsEvent_smartPageBlockId_day_idx" ON "AnalyticsEvent"("smartPageBlockId", "day");
CREATE INDEX "AnalyticsEvent_smartPageId_visitorHash_idx" ON "AnalyticsEvent"("smartPageId", "visitorHash");

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_smartPageId_fkey" FOREIGN KEY ("smartPageId") REFERENCES "SmartPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_smartPageBlockId_fkey" FOREIGN KEY ("smartPageBlockId") REFERENCES "SmartPageBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPage" ADD CONSTRAINT "SmartPage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageBlock" ADD CONSTRAINT "SmartPageBlock_smartPageId_fkey" FOREIGN KEY ("smartPageId") REFERENCES "SmartPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageBlock" ADD CONSTRAINT "SmartPageBlock_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShortLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;