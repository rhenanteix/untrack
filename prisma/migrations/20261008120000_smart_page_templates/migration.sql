-- CreateTable
CREATE TABLE "SmartPageTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "thumbnailUrl" VARCHAR(4096),
    "theme" JSONB NOT NULL DEFAULT '{}',
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "socialLinks" JSONB NOT NULL DEFAULT '[]',
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "SmartPageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmartPageTemplate_slug_key" ON "SmartPageTemplate"("slug");

-- CreateIndex
CREATE INDEX "SmartPageTemplate_category_published_idx" ON "SmartPageTemplate"("category", "published");

-- CreateIndex
CREATE INDEX "SmartPageTemplate_plan_published_idx" ON "SmartPageTemplate"("plan", "published");

