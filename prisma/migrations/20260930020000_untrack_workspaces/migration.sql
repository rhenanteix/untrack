BEGIN;
-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro', 'business');

-- DropIndex
DROP INDEX "ShortLink_slug_key";

-- DropIndex
DROP INDEX "LinkHistory_userId_importKey_key";

-- AlterTable
ALTER TABLE "ShortLink" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "distribution" TEXT NOT NULL DEFAULT 'digital',
ADD COLUMN     "domainKey" TEXT NOT NULL DEFAULT 'platform',
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "LinkHistory" ADD COLUMN     "workspaceId" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "governance" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "WorkspaceUsage" (
    "workspaceId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkspaceUsage_pkey" PRIMARY KEY ("workspaceId","resource")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtmTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "values" JSONB NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UtmTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtmLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "originalUrl" VARCHAR(4096) NOT NULL,
    "resultUrl" VARCHAR(8192) NOT NULL,
    "appliedValues" JSONB NOT NULL,
    "governanceSnapshot" JSONB NOT NULL,
    "templateId" TEXT,
    "clientId" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtmLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkFolder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,

    CONSTRAINT "LinkFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomDomain" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_dns',
    "verifiedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "mode" TEXT NOT NULL,
    "destinationUrl" VARCHAR(8192) NOT NULL,
    "encodedUrl" VARCHAR(8192) NOT NULL,
    "visual" JSONB NOT NULL,
    "campaignId" TEXT,
    "redirectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickOutbox" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "day" DATE NOT NULL,
    "referrer" VARCHAR(253) NOT NULL,
    "device" VARCHAR(20) NOT NULL,

    CONSTRAINT "ClickOutbox_pkey" PRIMARY KEY ("id")
);

-- Preserve existing private data in one personal workspace per existing user.
INSERT INTO "Workspace" ("id", "name", "updatedAt")
SELECT 'personal:' || "id", left("name" || ' — Workspace', 120), CURRENT_TIMESTAMP FROM "User";
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role")
SELECT 'personal:' || "id", "id", 'owner' FROM "User";
UPDATE "ShortLink" SET "workspaceId" = 'personal:' || "userId";
UPDATE "LinkHistory" SET "workspaceId" = 'personal:' || "userId";
ALTER TABLE "ShortLink" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "LinkHistory" ALTER COLUMN "workspaceId" SET NOT NULL;
INSERT INTO "WorkspaceUsage" ("workspaceId", "resource", "count")
SELECT "workspaceId", 'members', count(*) FROM "WorkspaceMember" GROUP BY "workspaceId";
INSERT INTO "WorkspaceUsage" ("workspaceId", "resource", "count")
SELECT "workspaceId", 'shortLinks', count(*) FROM "ShortLink" GROUP BY "workspaceId";
INSERT INTO "WorkspaceUsage" ("workspaceId", "resource", "count")
SELECT "workspaceId", 'history', count(*) FROM "LinkHistory" GROUP BY "workspaceId";
ALTER TABLE "WorkspaceUsage" ADD CONSTRAINT "WorkspaceUsage_nonnegative" CHECK ("count" >= 0);

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Client_workspaceId_createdAt_idx" ON "Client"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_id_workspaceId_key" ON "Client"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_createdAt_idx" ON "Campaign"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_id_workspaceId_key" ON "Campaign"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "UtmTemplate_workspaceId_createdAt_idx" ON "UtmTemplate"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "UtmLink_workspaceId_createdAt_idx" ON "UtmLink"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkFolder_id_workspaceId_key" ON "LinkFolder"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkFolder_workspaceId_name_key" ON "LinkFolder"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_hostname_key" ON "CustomDomain"("hostname");

-- CreateIndex
CREATE INDEX "CustomDomain_workspaceId_idx" ON "CustomDomain"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "QrAsset_redirectId_key" ON "QrAsset"("redirectId");

-- CreateIndex
CREATE INDEX "QrAsset_workspaceId_createdAt_idx" ON "QrAsset"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ClickOutbox_createdAt_idx" ON "ClickOutbox"("createdAt");

-- CreateIndex
CREATE INDEX "ShortLink_workspaceId_createdAt_idx" ON "ShortLink"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_domainKey_slug_key" ON "ShortLink"("domainKey", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_id_workspaceId_key" ON "ShortLink"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "LinkHistory_workspaceId_createdAt_idx" ON "LinkHistory"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkHistory_workspaceId_userId_importKey_key" ON "LinkHistory"("workspaceId", "userId", "importKey");

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_folderId_workspaceId_fkey" FOREIGN KEY ("folderId", "workspaceId") REFERENCES "LinkFolder"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_campaignId_workspaceId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkHistory" ADD CONSTRAINT "LinkHistory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUsage" ADD CONSTRAINT "WorkspaceUsage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_workspaceId_fkey" FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtmTemplate" ADD CONSTRAINT "UtmTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtmLink" ADD CONSTRAINT "UtmLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtmLink" ADD CONSTRAINT "UtmLink_clientId_workspaceId_fkey" FOREIGN KEY ("clientId", "workspaceId") REFERENCES "Client"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtmLink" ADD CONSTRAINT "UtmLink_campaignId_workspaceId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkFolder" ADD CONSTRAINT "LinkFolder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrAsset" ADD CONSTRAINT "QrAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrAsset" ADD CONSTRAINT "QrAsset_campaignId_workspaceId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrAsset" ADD CONSTRAINT "QrAsset_redirectId_fkey" FOREIGN KEY ("redirectId") REFERENCES "ShortLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
