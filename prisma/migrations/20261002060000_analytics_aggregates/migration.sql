CREATE TABLE "AnalyticsAggregate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "granularity" VARCHAR(8) NOT NULL,
  "eventName" VARCHAR(80) NOT NULL,
  "dimension" VARCHAR(20) NOT NULL,
  "dimensionValue" VARCHAR(255) NOT NULL,
  "isBot" BOOLEAN NOT NULL DEFAULT false,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsAggregate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnalyticsAggregate_workspaceId_bucketStart_granularity_eventName_dimension_dimensionValue_isBot_key" ON "AnalyticsAggregate"("workspaceId", "bucketStart", "granularity", "eventName", "dimension", "dimensionValue", "isBot");
CREATE INDEX "AnalyticsAggregate_workspaceId_bucketStart_granularity_dimension_idx" ON "AnalyticsAggregate"("workspaceId", "bucketStart", "granularity", "dimension");

ALTER TABLE "AnalyticsAggregate" ADD CONSTRAINT "AnalyticsAggregate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;