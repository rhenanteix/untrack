-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "CheckoutProvider" AS ENUM ('abacatepay', 'mercadopago', 'stripe');

-- CreateEnum
CREATE TYPE "CheckoutSessionStatus" AS ENUM ('pending', 'redirecting', 'completed', 'expired', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(5000) NOT NULL DEFAULT '',
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "OfferStatus" NOT NULL DEFAULT 'draft',
    "checkoutProvider" "CheckoutProvider",
    "checkoutConfiguration" JSONB DEFAULT '{}',
    "images" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "commerceLinkId" TEXT,
    "provider" "CheckoutProvider" NOT NULL,
    "providerSessionId" VARCHAR(255) NOT NULL,
    "trackingSessionId" VARCHAR(36),
    "journeyId" VARCHAR(36),
    "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'pending',
    "destinationUrl" VARCHAR(4096) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "providerPaymentId" VARCHAR(255) NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "paymentRecordId" TEXT NOT NULL,
    "providerRefundId" VARCHAR(255) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'pending',
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "campaignId" TEXT,
    "distributionId" TEXT,
    "channel" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "destination" VARCHAR(4096) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shortLinkId" TEXT,

    CONSTRAINT "CommerceLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_workspaceId_name_key" ON "Offer"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Offer_workspaceId_status_updatedAt_idx" ON "Offer"("workspaceId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Offer_workspaceId_checkoutProvider_idx" ON "Offer"("workspaceId", "checkoutProvider");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_provider_providerSessionId_key" ON "CheckoutSession"("provider", "providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_id_workspaceId_key" ON "CheckoutSession"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "CheckoutSession_workspaceId_offerId_status_idx" ON "CheckoutSession"("workspaceId", "offerId", "status");

-- CreateIndex
CREATE INDEX "CheckoutSession_workspaceId_status_updatedAt_idx" ON "CheckoutSession"("workspaceId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CheckoutSession_workspaceId_provider_idx" ON "CheckoutSession"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "CheckoutSession_expiresAt_idx" ON "CheckoutSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_checkoutSessionId_providerPaymentId_key" ON "PaymentRecord"("checkoutSessionId", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_id_workspaceId_key" ON "PaymentRecord"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "PaymentRecord_workspaceId_status_updatedAt_idx" ON "PaymentRecord"("workspaceId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PaymentRecord_workspaceId_providerPaymentId_idx" ON "PaymentRecord"("workspaceId", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentRecord_checkoutSessionId_status_idx" ON "PaymentRecord"("checkoutSessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_paymentRecordId_providerRefundId_key" ON "PaymentRefund"("paymentRecordId", "providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_id_workspaceId_key" ON "PaymentRefund"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "PaymentRefund_workspaceId_paymentRecordId_status_idx" ON "PaymentRefund"("workspaceId", "paymentRecordId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceLink_code_key" ON "CommerceLink"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceLink_id_workspaceId_key" ON "CommerceLink"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "CommerceLink_workspaceId_offerId_status_idx" ON "CommerceLink"("workspaceId", "offerId", "status");

-- CreateIndex
CREATE INDEX "CommerceLink_workspaceId_channel_idx" ON "CommerceLink"("workspaceId", "channel");

-- CreateIndex
CREATE INDEX "CommerceLink_workspaceId_campaignId_idx" ON "CommerceLink"("workspaceId", "campaignId");

-- CreateIndex
CREATE INDEX "CommerceLink_code_idx" ON "CommerceLink"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CommerceLink_shortLinkId_key" ON "CommerceLink"("shortLinkId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_commerceLinkId_fkey" FOREIGN KEY ("commerceLinkId") REFERENCES "CommerceLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentRecordId_fkey" FOREIGN KEY ("paymentRecordId") REFERENCES "PaymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceLink" ADD CONSTRAINT "CommerceLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceLink" ADD CONSTRAINT "CommerceLink_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceLink" ADD CONSTRAINT "CommerceLink_campaignId_fkey" FOREIGN KEY ("campaignId", "workspaceId") REFERENCES "Campaign"("id", "workspaceId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceLink" ADD CONSTRAINT "CommerceLink_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
