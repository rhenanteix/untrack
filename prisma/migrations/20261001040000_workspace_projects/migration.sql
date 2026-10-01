-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "ProjectResourceType" AS ENUM ('shortLink', 'smartPage', 'campaign', 'utmLink', 'qrAsset');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "icon" VARCHAR(40) NOT NULL DEFAULT 'folder',
    "color" VARCHAR(16) NOT NULL DEFAULT '#285239',
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectResource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "resourceType" "ProjectResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_slug_key" ON "Project"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_workspaceId_key" ON "Project"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Project_workspaceId_status_updatedAt_idx" ON "Project"("workspaceId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectResource_projectId_resourceType_resourceId_key" ON "ProjectResource"("projectId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ProjectResource_projectId_createdAt_idx" ON "ProjectResource"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectResource_workspaceId_resourceType_resourceId_idx" ON "ProjectResource"("workspaceId", "resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_projectId_workspaceId_fkey" FOREIGN KEY ("projectId", "workspaceId") REFERENCES "Project"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;