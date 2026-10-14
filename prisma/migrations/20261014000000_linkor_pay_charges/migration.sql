-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('draft', 'pending', 'paid', 'expired', 'cancelled', 'refunded');

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "customerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "ChargeStatus" NOT NULL DEFAULT 'draft',
    "offerId" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Charge_workspaceId_status_createdAt_idx" ON "Charge"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Charge_workspaceId_customerId_idx" ON "Charge"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "Charge_workspaceId_offerId_idx" ON "Charge"("workspaceId", "offerId");

-- CreateIndex
CREATE INDEX "Charge_workspaceId_dueAt_idx" ON "Charge"("workspaceId", "dueAt");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_customerId_fkey" FOREIGN KEY ("customerId", "workspaceId") REFERENCES "AudienceContact"("id", "workspaceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
