-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "approvalStatus" VARCHAR(20),
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "description" VARCHAR(2000),
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "objective" VARCHAR(1000),
ADD COLUMN     "responsibleId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20);

-- Preserve existing campaigns: initialize the new timestamp from their creation date.
UPDATE "Campaign" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Campaign" ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "CampaignChannel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "utmSource" VARCHAR(120),
    "utmMedium" VARCHAR(120),
    "utmCampaign" VARCHAR(120),
    "utmTerm" VARCHAR(120),
    "utmContent" VARCHAR(120),
    "destinationUrl" VARCHAR(4096) NOT NULL,
    "shortLinkId" TEXT,
    "qrId" TEXT,
    "templateId" TEXT,
    "monitorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "monitorFrequencyMinutes" INTEGER NOT NULL DEFAULT 60,
    "monitorPaused" BOOLEAN NOT NULL DEFAULT false,
    "alternativeDestinationUrl" VARCHAR(4096),
    "autoRedirectOnIncident" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignChecklist" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channelId" TEXT,
    "category" VARCHAR(60) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "severity" VARCHAR(20) NOT NULL DEFAULT 'warning',
    "details" VARCHAR(2000) NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMonitorCheck" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channelId" TEXT,
    "url" VARCHAR(4096) NOT NULL,
    "httpStatus" INTEGER,
    "responseTimeMs" INTEGER,
    "finalUrl" VARCHAR(4096),
    "redirectChain" JSONB NOT NULL,
    "connectionError" TEXT,
    "certExpiresAt" TIMESTAMP(3),
    "certIssuer" VARCHAR(200),
    "status" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMonitorCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignIncident" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channelId" TEXT,
    "code" VARCHAR(80) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "severity" VARCHAR(20) NOT NULL DEFAULT 'warning',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" VARCHAR(200) NOT NULL,
    "cooldownUntil" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignApproval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "notes" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "incidentId" TEXT,
    "adapter" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignChannel_workspaceId_campaignId_idx" ON "CampaignChannel"("workspaceId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignChannel_campaignId_idx" ON "CampaignChannel"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignChannel_id_workspaceId_key" ON "CampaignChannel"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "CampaignChecklist_workspaceId_campaignId_idx" ON "CampaignChecklist"("workspaceId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignChecklist_campaignId_status_idx" ON "CampaignChecklist"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignMonitorCheck_workspaceId_checkedAt_idx" ON "CampaignMonitorCheck"("workspaceId", "checkedAt");

-- CreateIndex
CREATE INDEX "CampaignMonitorCheck_campaignId_checkedAt_idx" ON "CampaignMonitorCheck"("campaignId", "checkedAt");

-- CreateIndex
CREATE INDEX "CampaignMonitorCheck_channelId_checkedAt_idx" ON "CampaignMonitorCheck"("channelId", "checkedAt");

-- CreateIndex
CREATE INDEX "CampaignIncident_workspaceId_dedupeKey_createdAt_idx" ON "CampaignIncident"("workspaceId", "dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "CampaignIncident_campaignId_status_idx" ON "CampaignIncident"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignIncident_channelId_status_idx" ON "CampaignIncident"("channelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignIncident_id_workspaceId_key" ON "CampaignIncident"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "CampaignApproval_workspaceId_campaignId_idx" ON "CampaignApproval"("workspaceId", "campaignId");

-- CreateIndex
CREATE INDEX "CampaignApproval_campaignId_createdAt_idx" ON "CampaignApproval"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_workspaceId_incidentId_idx" ON "NotificationDelivery"("workspaceId", "incidentId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_status_idx" ON "Campaign"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_clientId_idx" ON "Campaign"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "Campaign_responsibleId_idx" ON "Campaign"("responsibleId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignChannel" ADD CONSTRAINT "CampaignChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignChannel" ADD CONSTRAINT "CampaignChannel_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignChecklist" ADD CONSTRAINT "CampaignChecklist_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignChecklist" ADD CONSTRAINT "CampaignChecklist_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMonitorCheck" ADD CONSTRAINT "CampaignMonitorCheck_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMonitorCheck" ADD CONSTRAINT "CampaignMonitorCheck_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CampaignChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMonitorCheck" ADD CONSTRAINT "CampaignMonitorCheck_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIncident" ADD CONSTRAINT "CampaignIncident_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIncident" ADD CONSTRAINT "CampaignIncident_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignIncident" ADD CONSTRAINT "CampaignIncident_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CampaignChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
