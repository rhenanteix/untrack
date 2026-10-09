-- CreateEnum
CREATE TYPE "ConnectSourceType" AS ENUM ('owned_asset', 'external_site', 'conversion_api', 'connector');

-- CreateEnum
CREATE TYPE "ConnectSourceTrust" AS ENUM ('public', 'authenticated', 'internal');

-- CreateEnum
CREATE TYPE "ConnectProjection" AS ENUM ('isolated', 'native');

-- CreateEnum
CREATE TYPE "ConnectReceiptState" AS ENUM ('queued', 'processing', 'normalized', 'rejected', 'dead_letter');

-- AlterTable
ALTER TABLE "AnalyticsEvent" ADD COLUMN     "connectPayloadHash" VARCHAR(64),
ADD COLUMN     "consentContext" JSONB,
ADD COLUMN     "correlationId" VARCHAR(36),
ADD COLUMN     "eventVersion" INTEGER,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "sourceConnectionId" TEXT,
ADD COLUMN     "sourceType" VARCHAR(32);

-- CreateTable
CREATE TABLE "ConnectSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "type" "ConnectSourceType" NOT NULL,
    "trust" "ConnectSourceTrust" NOT NULL,
    "projection" "ConnectProjection" NOT NULL DEFAULT 'isolated',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "credentialHash" VARCHAR(64),
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedEvents" TEXT[],
    "requiresConsent" BOOLEAN NOT NULL DEFAULT true,
    "expectedIntervalSeconds" INTEGER,
    "lastReceivedAt" TIMESTAMP(3),
    "lastProcessedAt" TIMESTAMP(3),
    "eventWatermark" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectReceipt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceConnectionId" TEXT NOT NULL,
    "eventId" VARCHAR(36),
    "eventName" VARCHAR(80),
    "eventVersion" INTEGER,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "correlationId" VARCHAR(36) NOT NULL,
    "state" "ConnectReceiptState" NOT NULL DEFAULT 'queued',
    "rawPayload" JSONB,
    "normalizedPayload" JSONB,
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "rawExpiresAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" VARCHAR(36),
    "errorCode" VARCHAR(64),
    "analyticsEventId" VARCHAR(255),
    "replayCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConnectReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "state" VARCHAR(24) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorCode" VARCHAR(64),

    CONSTRAINT "ConnectDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectSource_credentialHash_key" ON "ConnectSource"("credentialHash");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectSource_workspaceId_key_key" ON "ConnectSource"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectSource_id_workspaceId_key" ON "ConnectSource"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "ConnectReceipt_workspaceId_sourceConnectionId_receivedAt_idx" ON "ConnectReceipt"("workspaceId", "sourceConnectionId", "receivedAt");

-- CreateIndex
CREATE INDEX "ConnectReceipt_state_nextAttemptAt_leaseUntil_idx" ON "ConnectReceipt"("state", "nextAttemptAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "ConnectReceipt_expiresAt_idx" ON "ConnectReceipt"("expiresAt");

-- CreateIndex
CREATE INDEX "ConnectReceipt_rawExpiresAt_idx" ON "ConnectReceipt"("rawExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectReceipt_workspaceId_sourceConnectionId_idempotencyKe_key" ON "ConnectReceipt"("workspaceId", "sourceConnectionId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectReceipt_id_workspaceId_key" ON "ConnectReceipt"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "ConnectDeliveryAttempt_workspaceId_startedAt_state_idx" ON "ConnectDeliveryAttempt"("workspaceId", "startedAt", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectDeliveryAttempt_receiptId_number_key" ON "ConnectDeliveryAttempt"("receiptId", "number");

-- AddForeignKey
ALTER TABLE "ConnectSource" ADD CONSTRAINT "ConnectSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectReceipt" ADD CONSTRAINT "ConnectReceipt_sourceConnectionId_workspaceId_fkey" FOREIGN KEY ("sourceConnectionId", "workspaceId") REFERENCES "ConnectSource"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectDeliveryAttempt" ADD CONSTRAINT "ConnectDeliveryAttempt_receiptId_workspaceId_fkey" FOREIGN KEY ("receiptId", "workspaceId") REFERENCES "ConnectReceipt"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Native metrics have one explicit authority per tenant; external metrics remain isolated.
CREATE UNIQUE INDEX "ConnectSource_native_authority_key" ON "ConnectSource" ("workspaceId")
WHERE "projection" = 'native' AND "enabled" = true;
ALTER TABLE "ConnectSource" ADD CONSTRAINT "ConnectSource_native_trust_check"
CHECK ("projection" <> 'native' OR ("type" = 'owned_asset' AND "trust" = 'internal'));
ALTER TABLE "ConnectSource" ADD CONSTRAINT "ConnectSource_public_policy_check"
CHECK ("trust" <> 'public' OR ("type" = 'external_site' AND "requiresConsent" = true AND cardinality("allowedOrigins") > 0));
ALTER TABLE "ConnectReceipt" ADD CONSTRAINT "ConnectReceipt_attempts_check" CHECK ("attempts" >= 0 AND "replayCount" >= 0);

-- Transaction-local context; pooled connections never inherit another request's tenant.
-- Superusers/BYPASSRLS remain an operational trust boundary even with FORCE RLS.
ALTER TABLE "ConnectSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectSource" FORCE ROW LEVEL SECURITY;
CREATE POLICY "connect_source_tenant" ON "ConnectSource" FOR ALL
USING ("workspaceId" = current_setting('app.workspace_id', true) OR current_setting('app.connect_worker', true) = 'on')
WITH CHECK ("workspaceId" = current_setting('app.workspace_id', true) OR current_setting('app.connect_worker', true) = 'on');
ALTER TABLE "ConnectReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectReceipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY "connect_receipt_tenant" ON "ConnectReceipt" FOR ALL
USING ("workspaceId" = current_setting('app.workspace_id', true) OR current_setting('app.connect_worker', true) = 'on')
WITH CHECK ("workspaceId" = current_setting('app.workspace_id', true) OR current_setting('app.connect_worker', true) = 'on');
ALTER TABLE "ConnectDeliveryAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConnectDeliveryAttempt" FORCE ROW LEVEL SECURITY;
CREATE POLICY "connect_attempt_tenant" ON "ConnectDeliveryAttempt" FOR ALL
USING ("workspaceId" = current_setting('app.workspace_id', true) OR current_setting('app.connect_worker', true) = 'on')
WITH CHECK ("workspaceId" = current_setting('app.workspace_id', true) OR current_setting('app.connect_worker', true) = 'on');
