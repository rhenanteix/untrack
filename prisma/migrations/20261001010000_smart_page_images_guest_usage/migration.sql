CREATE TABLE "SmartPageImage" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartPageImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SmartPageImage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SmartPage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SmartPageImage_pageId_idx" ON "SmartPageImage"("pageId");
CREATE TABLE "AnonymousUse" (
  "keyHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnonymousUse_pkey" PRIMARY KEY ("keyHash")
);
