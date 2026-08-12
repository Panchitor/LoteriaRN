CREATE TABLE "DeviceActivationCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceActivationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceActivationCode_code_key" ON "DeviceActivationCode"("code");
CREATE INDEX "DeviceActivationCode_device_id_created_at_idx" ON "DeviceActivationCode"("device_id", "created_at");
CREATE INDEX "DeviceActivationCode_expires_at_used_at_idx" ON "DeviceActivationCode"("expires_at", "used_at");
ALTER TABLE "DeviceActivationCode" ADD CONSTRAINT "DeviceActivationCode_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
