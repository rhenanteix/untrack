-- AddColumn
ALTER TABLE "Charge" ADD COLUMN "shareToken" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "Charge_shareToken_key" ON "Charge"("shareToken");
