-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('physical', 'digital', 'course', 'booking', 'session', 'mentorship', 'coaching', 'bundle', 'event', 'subscription');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" VARCHAR(5000) NOT NULL DEFAULT '',
    "type" "ProductType" NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "priceInCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "images" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SmartPageBlock" ADD COLUMN "productId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_workspaceId_slug_key" ON "Product"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "Product_workspaceId_status_updatedAt_idx" ON "Product"("workspaceId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SmartPageBlock_productId_idx" ON "SmartPageBlock"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartPageBlock" ADD CONSTRAINT "SmartPageBlock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;