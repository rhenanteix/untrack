CREATE TYPE "SmartCardStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "SmartCardActionType" AS ENUM ('website', 'whatsapp', 'email', 'phone', 'calendar', 'smartPage', 'custom');
CREATE TYPE "AudienceContactStatus" AS ENUM ('new_contact', 'interested', 'qualified', 'customer', 'not_interested');
CREATE TYPE "ContactTemperature" AS ENUM ('cold', 'warm', 'hot');

ALTER TABLE "AnalyticsEvent"
  ADD COLUMN "smartCardId" TEXT,
  ADD COLUMN "smartCardActionId" TEXT;

CREATE TABLE "SmartCard" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "campaignId" TEXT,
  "qrAssetId" TEXT,
  "slug" VARCHAR(60) NOT NULL,
  "firstName" VARCHAR(80) NOT NULL,
  "lastName" VARCHAR(80) NOT NULL DEFAULT '',
  "headline" VARCHAR(160) NOT NULL DEFAULT '',
  "company" VARCHAR(120) NOT NULL DEFAULT '',
  "bio" VARCHAR(500) NOT NULL DEFAULT '',
  "avatarUrl" VARCHAR(4096),
  "logoUrl" VARCHAR(4096),
  "phone" VARCHAR(40),
  "whatsapp" VARCHAR(40),
  "email" VARCHAR(254),
  "websiteUrl" VARCHAR(4096),
  "location" VARCHAR(160),
  "theme" JSONB NOT NULL DEFAULT '{}',
  "contactForm" JSONB NOT NULL DEFAULT '{}',
  "privacyPolicyUrl" VARCHAR(4096),
  "status" "SmartCardStatus" NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartCardAction" (
  "id" TEXT NOT NULL,
  "smartCardId" TEXT NOT NULL,
  "type" "SmartCardActionType" NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "url" VARCHAR(4096) NOT NULL,
  "position" INTEGER NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartCardAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AudienceContact" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "firstName" VARCHAR(80) NOT NULL DEFAULT '',
  "lastName" VARCHAR(80) NOT NULL DEFAULT '',
  "email" VARCHAR(254),
  "phone" VARCHAR(40),
  "whatsapp" VARCHAR(40),
  "company" VARCHAR(120),
  "jobTitle" VARCHAR(160),
  "city" VARCHAR(120),
  "customFields" JSONB NOT NULL DEFAULT '{}',
  "status" "AudienceContactStatus" NOT NULL DEFAULT 'new_contact',
  "temperature" "ContactTemperature" NOT NULL DEFAULT 'cold',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AudienceContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartCardContactExchange" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "smartCardId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "campaignId" TEXT,
  "source" VARCHAR(80) NOT NULL DEFAULT 'direct',
  "sourceLabel" VARCHAR(120),
  "intent" VARCHAR(160),
  "context" JSONB NOT NULL DEFAULT '{}',
  "consentText" VARCHAR(1000) NOT NULL,
  "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartCardContactExchange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AudienceContactEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AudienceContactEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartCard_slug_key" ON "SmartCard"("slug");
CREATE UNIQUE INDEX "SmartCard_qrAssetId_key" ON "SmartCard"("qrAssetId");
CREATE INDEX "SmartCard_workspaceId_status_updatedAt_idx" ON "SmartCard"("workspaceId", "status", "updatedAt");
CREATE INDEX "SmartCard_ownerId_createdAt_idx" ON "SmartCard"("ownerId", "createdAt");
CREATE INDEX "SmartCard_campaignId_idx" ON "SmartCard"("campaignId");
CREATE UNIQUE INDEX "SmartCardAction_smartCardId_position_key" ON "SmartCardAction"("smartCardId", "position");
CREATE INDEX "SmartCardAction_smartCardId_position_idx" ON "SmartCardAction"("smartCardId", "position");
CREATE INDEX "AudienceContact_workspaceId_createdAt_idx" ON "AudienceContact"("workspaceId", "createdAt");
CREATE INDEX "AudienceContact_workspaceId_email_idx" ON "AudienceContact"("workspaceId", "email");
CREATE INDEX "AudienceContact_workspaceId_phone_idx" ON "AudienceContact"("workspaceId", "phone");
CREATE INDEX "SmartCardContactExchange_workspaceId_capturedAt_idx" ON "SmartCardContactExchange"("workspaceId", "capturedAt");
CREATE INDEX "SmartCardContactExchange_smartCardId_capturedAt_idx" ON "SmartCardContactExchange"("smartCardId", "capturedAt");
CREATE INDEX "SmartCardContactExchange_contactId_capturedAt_idx" ON "SmartCardContactExchange"("contactId", "capturedAt");
CREATE INDEX "SmartCardContactExchange_campaignId_capturedAt_idx" ON "SmartCardContactExchange"("campaignId", "capturedAt");
CREATE INDEX "AudienceContactEvent_contactId_occurredAt_idx" ON "AudienceContactEvent"("contactId", "occurredAt");
CREATE INDEX "AudienceContactEvent_workspaceId_occurredAt_idx" ON "AudienceContactEvent"("workspaceId", "occurredAt");
CREATE INDEX "AnalyticsEvent_smartCardId_day_idx" ON "AnalyticsEvent"("smartCardId", "day");
CREATE INDEX "AnalyticsEvent_smartCardActionId_day_idx" ON "AnalyticsEvent"("smartCardActionId", "day");
CREATE INDEX "AnalyticsEvent_smartCardId_visitorHash_idx" ON "AnalyticsEvent"("smartCardId", "visitorHash");

ALTER TABLE "SmartCard" ADD CONSTRAINT "SmartCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCard" ADD CONSTRAINT "SmartCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCard" ADD CONSTRAINT "SmartCard_campaignId_workspaceId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SmartCard" ADD CONSTRAINT "SmartCard_qrAssetId_fkey" FOREIGN KEY ("qrAssetId") REFERENCES "QrAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmartCardAction" ADD CONSTRAINT "SmartCardAction_smartCardId_fkey" FOREIGN KEY ("smartCardId") REFERENCES "SmartCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudienceContact" ADD CONSTRAINT "AudienceContact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCardContactExchange" ADD CONSTRAINT "SmartCardContactExchange_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCardContactExchange" ADD CONSTRAINT "SmartCardContactExchange_smartCardId_fkey" FOREIGN KEY ("smartCardId") REFERENCES "SmartCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCardContactExchange" ADD CONSTRAINT "SmartCardContactExchange_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "AudienceContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCardContactExchange" ADD CONSTRAINT "SmartCardContactExchange_campaignId_workspaceId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AudienceContactEvent" ADD CONSTRAINT "AudienceContactEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudienceContactEvent" ADD CONSTRAINT "AudienceContactEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "AudienceContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_smartCardId_fkey" FOREIGN KEY ("smartCardId") REFERENCES "SmartCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_smartCardActionId_fkey" FOREIGN KEY ("smartCardActionId") REFERENCES "SmartCardAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;