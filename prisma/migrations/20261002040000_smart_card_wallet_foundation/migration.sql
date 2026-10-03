CREATE TYPE "SmartCardWalletProvider" AS ENUM ('apple', 'google');
CREATE TYPE "SmartCardWalletPassStatus" AS ENUM ('pending_sync', 'synced', 'sync_failed', 'revoked');

ALTER TABLE "SmartCard"
  ADD COLUMN "contactPoints" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "SmartCardWalletPass" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "smartCardId" TEXT NOT NULL,
  "provider" "SmartCardWalletProvider" NOT NULL,
  "status" "SmartCardWalletPassStatus" NOT NULL DEFAULT 'pending_sync',
  "serialNumber" VARCHAR(120),
  "externalObjectId" VARCHAR(255),
  "issuedAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartCardWalletPass_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartCardWalletPass_serialNumber_key" ON "SmartCardWalletPass"("serialNumber");
CREATE UNIQUE INDEX "SmartCardWalletPass_externalObjectId_key" ON "SmartCardWalletPass"("externalObjectId");
CREATE UNIQUE INDEX "SmartCardWalletPass_smartCardId_provider_key" ON "SmartCardWalletPass"("smartCardId", "provider");
CREATE INDEX "SmartCardWalletPass_workspaceId_status_updatedAt_idx" ON "SmartCardWalletPass"("workspaceId", "status", "updatedAt");
CREATE INDEX "SmartCardWalletPass_smartCardId_updatedAt_idx" ON "SmartCardWalletPass"("smartCardId", "updatedAt");

ALTER TABLE "SmartCardWalletPass" ADD CONSTRAINT "SmartCardWalletPass_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartCardWalletPass" ADD CONSTRAINT "SmartCardWalletPass_smartCardId_fkey" FOREIGN KEY ("smartCardId") REFERENCES "SmartCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;