-- CreateEnum
CREATE TYPE "WorkspaceResourceType" AS ENUM ('project', 'shortLink', 'smartPage', 'campaign', 'utmLink', 'qrAsset');

-- CreateEnum
CREATE TYPE "CollectionKind" AS ENUM ('manual', 'smart');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('owner', 'editor', 'viewer');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "goal" VARCHAR(40);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId", "userId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "color" VARCHAR(16) NOT NULL DEFAULT '#285239',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceTag" (
    "workspaceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "resourceType" "WorkspaceResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceTag_pkey" PRIMARY KEY ("tagId", "resourceType", "resourceId")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "WorkspaceResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("workspaceId", "userId", "resourceType", "resourceId")
);

-- CreateTable
CREATE TABLE "RecentResource" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "WorkspaceResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecentResource_pkey" PRIMARY KEY ("workspaceId", "userId", "resourceType", "resourceId")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "kind" "CollectionKind" NOT NULL DEFAULT 'manual',
    "rules" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionResource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "resourceType" "WorkspaceResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_workspaceId_slug_key" ON "Tag"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_id_workspaceId_key" ON "Tag"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Tag_workspaceId_archivedAt_name_idx" ON "Tag"("workspaceId", "archivedAt", "name");

-- CreateIndex
CREATE INDEX "ResourceTag_workspaceId_resourceType_resourceId_idx" ON "ResourceTag"("workspaceId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "Favorite_workspaceId_userId_createdAt_idx" ON "Favorite"("workspaceId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecentResource_workspaceId_userId_viewedAt_idx" ON "RecentResource"("workspaceId", "userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_id_workspaceId_key" ON "Collection"("id", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_workspaceId_projectId_name_key" ON "Collection"("workspaceId", "projectId", "name");

-- CreateIndex
CREATE INDEX "Collection_workspaceId_projectId_updatedAt_idx" ON "Collection"("workspaceId", "projectId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionResource_collectionId_resourceType_resourceId_key" ON "CollectionResource"("collectionId", "resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionResource_collectionId_position_key" ON "CollectionResource"("collectionId", "position");

-- CreateIndex
CREATE INDEX "CollectionResource_workspaceId_resourceType_resourceId_idx" ON "CollectionResource"("workspaceId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "CollectionResource_collectionId_position_idx" ON "CollectionResource"("collectionId", "position");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceTag" ADD CONSTRAINT "ResourceTag_tagId_workspaceId_fkey" FOREIGN KEY ("tagId", "workspaceId") REFERENCES "Tag"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentResource" ADD CONSTRAINT "RecentResource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentResource" ADD CONSTRAINT "RecentResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionResource" ADD CONSTRAINT "CollectionResource_collectionId_workspaceId_fkey" FOREIGN KEY ("collectionId", "workspaceId") REFERENCES "Collection"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;