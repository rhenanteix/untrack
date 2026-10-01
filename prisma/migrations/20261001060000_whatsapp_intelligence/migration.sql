CREATE TYPE "WhatsappLinkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

ALTER TYPE "ProjectResourceType" ADD VALUE IF NOT EXISTS 'whatsappLink';
ALTER TYPE "WorkspaceResourceType" ADD VALUE IF NOT EXISTS 'whatsappLink';

CREATE TABLE "WhatsappLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phoneNumber" VARCHAR(15) NOT NULL,
    "message" VARCHAR(4096) NOT NULL DEFAULT '',
    "campaignId" TEXT,
    "smartLinkId" TEXT,
    "status" "WhatsappLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "trackingConfig" JSONB NOT NULL DEFAULT '{"enabled":true}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappLink_smartLinkId_key" ON "WhatsappLink"("smartLinkId");
CREATE INDEX "WhatsappLink_workspaceId_status_updatedAt_idx" ON "WhatsappLink"("workspaceId", "status", "updatedAt");
CREATE INDEX "WhatsappLink_workspaceId_phoneNumber_campaignId_idx" ON "WhatsappLink"("workspaceId", "phoneNumber", "campaignId");
CREATE INDEX "WhatsappLink_campaignId_idx" ON "WhatsappLink"("campaignId");

ALTER TABLE "WhatsappLink" ADD CONSTRAINT "WhatsappLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappLink" ADD CONSTRAINT "WhatsappLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsappLink" ADD CONSTRAINT "WhatsappLink_smartLinkId_fkey" FOREIGN KEY ("smartLinkId") REFERENCES "ShortLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;