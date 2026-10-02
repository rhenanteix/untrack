-- Additive fields preserve existing campaign records and their legacy objective text.
ALTER TABLE "Campaign"
ADD COLUMN "objectiveType" VARCHAR(40),
ADD COLUMN "primaryDestinationType" VARCHAR(40),
ADD COLUMN "primaryDestinationId" VARCHAR(255),
ADD COLUMN "primaryDestinationUrl" VARCHAR(4096);

CREATE TABLE "CampaignAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "assetType" VARCHAR(80) NOT NULL,
    "destinationType" VARCHAR(40) NOT NULL,
    "destinationId" VARCHAR(255),
    "destinationUrl" VARCHAR(4096),
    "linkId" TEXT,
    "qrId" TEXT,
    "whatsappLinkId" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignAsset_id_workspaceId_key" ON "CampaignAsset"("id", "workspaceId");
CREATE INDEX "CampaignAsset_workspaceId_campaignId_idx" ON "CampaignAsset"("workspaceId", "campaignId");
CREATE INDEX "CampaignAsset_campaignId_channelId_idx" ON "CampaignAsset"("campaignId", "channelId");
CREATE INDEX "CampaignAsset_linkId_idx" ON "CampaignAsset"("linkId");
CREATE INDEX "CampaignAsset_qrId_idx" ON "CampaignAsset"("qrId");
CREATE INDEX "CampaignAsset_whatsappLinkId_idx" ON "CampaignAsset"("whatsappLinkId");

ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CampaignChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShortLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_qrId_fkey" FOREIGN KEY ("qrId") REFERENCES "QrAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignAsset" ADD CONSTRAINT "CampaignAsset_whatsappLinkId_fkey" FOREIGN KEY ("whatsappLinkId") REFERENCES "WhatsappLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;