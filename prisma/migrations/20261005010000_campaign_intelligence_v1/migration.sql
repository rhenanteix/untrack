ALTER TABLE "AnalyticsEvent"
  ADD COLUMN "campaignAssetId" VARCHAR(255);

ALTER TABLE "AnalyticsConversion"
  ADD COLUMN "campaignAssetId" VARCHAR(255);

ALTER TABLE "SmartPageFormSubmission"
  ADD COLUMN "campaignAssetId" TEXT;

ALTER TABLE "Campaign"
  ADD COLUMN "primaryGoalId" TEXT;

UPDATE "Campaign"
SET "status" = CASE "status"
  WHEN 'scheduled' THEN 'draft'
  WHEN 'paused' THEN 'archived'
  ELSE "status"
END
WHERE "status" IN ('scheduled', 'paused');

CREATE INDEX "AnalyticsEvent_campaignAssetId_occurredAt_idx"
  ON "AnalyticsEvent"("campaignAssetId", "occurredAt");

CREATE INDEX "AnalyticsConversion_workspaceId_campaignAssetId_occurredAt_idx"
  ON "AnalyticsConversion"("workspaceId", "campaignAssetId", "occurredAt");

CREATE INDEX "SmartPageFormSubmission_workspaceId_campaignAssetId_submittedAt_idx"
  ON "SmartPageFormSubmission"("workspaceId", "campaignAssetId", "submittedAt");

CREATE INDEX "Campaign_workspaceId_primaryGoalId_idx"
  ON "Campaign"("workspaceId", "primaryGoalId");

ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_primaryGoalId_fkey"
  FOREIGN KEY ("primaryGoalId") REFERENCES "AnalyticsGoal"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;