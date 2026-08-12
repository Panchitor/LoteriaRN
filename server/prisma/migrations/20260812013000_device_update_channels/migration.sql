ALTER TABLE "Device" ADD COLUMN "update_channel" TEXT NOT NULL DEFAULT 'STABLE';
CREATE INDEX "Device_update_channel_idx" ON "Device"("update_channel");
