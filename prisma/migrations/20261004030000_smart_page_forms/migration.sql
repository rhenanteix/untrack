CREATE TYPE "SmartPageFormStatus" AS ENUM ('active', 'inactive');

ALTER TABLE "AnalyticsVisitor"
  ADD COLUMN "audienceContactId" TEXT;

ALTER TABLE "AudienceContact"
  ADD COLUMN "firstSource" VARCHAR(253),
  ADD COLUMN "firstMedium" VARCHAR(120),
  ADD COLUMN "firstChannel" VARCHAR(40),
  ADD COLUMN "firstCampaign" VARCHAR(120),
  ADD COLUMN "lastSource" VARCHAR(253),
  ADD COLUMN "lastMedium" VARCHAR(120),
  ADD COLUMN "lastChannel" VARCHAR(40),
  ADD COLUMN "lastCampaign" VARCHAR(120);

CREATE TABLE "SmartPageForm" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "smartPageId" TEXT NOT NULL,
  "smartPageBlockId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "submitLabel" VARCHAR(80) NOT NULL DEFAULT 'Enviar',
  "successMessage" VARCHAR(500) NOT NULL DEFAULT 'Obrigado! Recebemos seus dados.',
  "privacyPolicyUrl" VARCHAR(4096),
  "status" "SmartPageFormStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartPageForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartPageFormField" (
  "id" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "fieldType" VARCHAR(40) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "placeholder" VARCHAR(160),
  "required" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL,
  "options" JSONB NOT NULL DEFAULT '[]',
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartPageFormField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmartPageFormSubmission" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "smartPageId" TEXT NOT NULL,
  "contactId" TEXT,
  "visitorId" TEXT,
  "sessionId" TEXT,
  "campaignId" TEXT,
  "source" VARCHAR(253) NOT NULL DEFAULT 'direct',
  "medium" VARCHAR(120),
  "channel" VARCHAR(40),
  "values" JSONB NOT NULL DEFAULT '{}',
  "consentGiven" BOOLEAN NOT NULL DEFAULT false,
  "consentText" VARCHAR(1000),
  "consentedAt" TIMESTAMP(3),
  "idempotencyKey" VARCHAR(64) NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartPageFormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartPageForm_smartPageBlockId_key" ON "SmartPageForm"("smartPageBlockId");
CREATE INDEX "SmartPageForm_workspaceId_createdAt_idx" ON "SmartPageForm"("workspaceId", "createdAt");
CREATE INDEX "SmartPageForm_smartPageId_status_idx" ON "SmartPageForm"("smartPageId", "status");
CREATE UNIQUE INDEX "SmartPageFormField_formId_position_key" ON "SmartPageFormField"("formId", "position");
CREATE INDEX "SmartPageFormField_formId_position_idx" ON "SmartPageFormField"("formId", "position");
CREATE UNIQUE INDEX "SmartPageFormSubmission_formId_idempotencyKey_key" ON "SmartPageFormSubmission"("formId", "idempotencyKey");
CREATE INDEX "SmartPageFormSubmission_workspaceId_submittedAt_idx" ON "SmartPageFormSubmission"("workspaceId", "submittedAt");
CREATE INDEX "SmartPageFormSubmission_formId_submittedAt_idx" ON "SmartPageFormSubmission"("formId", "submittedAt");
CREATE INDEX "SmartPageFormSubmission_smartPageId_submittedAt_idx" ON "SmartPageFormSubmission"("smartPageId", "submittedAt");
CREATE INDEX "SmartPageFormSubmission_contactId_submittedAt_idx" ON "SmartPageFormSubmission"("contactId", "submittedAt");
CREATE INDEX "SmartPageFormSubmission_visitorId_submittedAt_idx" ON "SmartPageFormSubmission"("visitorId", "submittedAt");
CREATE INDEX "SmartPageFormSubmission_sessionId_submittedAt_idx" ON "SmartPageFormSubmission"("sessionId", "submittedAt");
CREATE INDEX "SmartPageFormSubmission_campaignId_submittedAt_idx" ON "SmartPageFormSubmission"("campaignId", "submittedAt");
CREATE INDEX "AnalyticsVisitor_audienceContactId_idx" ON "AnalyticsVisitor"("audienceContactId");
CREATE INDEX "AudienceContact_workspaceId_firstCampaign_idx" ON "AudienceContact"("workspaceId", "firstCampaign");
CREATE INDEX "AudienceContact_workspaceId_lastCampaign_idx" ON "AudienceContact"("workspaceId", "lastCampaign");

ALTER TABLE "AnalyticsVisitor" ADD CONSTRAINT "AnalyticsVisitor_audienceContactId_fkey" FOREIGN KEY ("audienceContactId") REFERENCES "AudienceContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmartPageForm" ADD CONSTRAINT "SmartPageForm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageForm" ADD CONSTRAINT "SmartPageForm_smartPageId_fkey" FOREIGN KEY ("smartPageId") REFERENCES "SmartPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageForm" ADD CONSTRAINT "SmartPageForm_smartPageBlockId_fkey" FOREIGN KEY ("smartPageBlockId") REFERENCES "SmartPageBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormField" ADD CONSTRAINT "SmartPageFormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SmartPageForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormSubmission" ADD CONSTRAINT "SmartPageFormSubmission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormSubmission" ADD CONSTRAINT "SmartPageFormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "SmartPageForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormSubmission" ADD CONSTRAINT "SmartPageFormSubmission_smartPageId_fkey" FOREIGN KEY ("smartPageId") REFERENCES "SmartPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormSubmission" ADD CONSTRAINT "SmartPageFormSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "AudienceContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormSubmission" ADD CONSTRAINT "SmartPageFormSubmission_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormSubmission" ADD CONSTRAINT "SmartPageFormSubmission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnalyticsSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmartPageFormSubmission" ADD CONSTRAINT "SmartPageFormSubmission_campaignId_workspaceId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;