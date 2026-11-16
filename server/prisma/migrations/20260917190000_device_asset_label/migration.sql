ALTER TABLE "Device" ADD COLUMN "asset_label" TEXT;
CREATE UNIQUE INDEX "Device_asset_label_key" ON "Device"("asset_label");
