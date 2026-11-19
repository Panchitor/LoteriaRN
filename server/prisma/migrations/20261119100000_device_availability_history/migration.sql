ALTER TABLE "Device"
  ADD COLUMN "availability_started_at" TIMESTAMP(3),
  ADD COLUMN "availability_tracking_since" TIMESTAMP(3);

CREATE TABLE "DeviceAvailabilityPeriod" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceAvailabilityPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceAvailabilityPeriod_device_id_started_at_idx"
  ON "DeviceAvailabilityPeriod"("device_id", "started_at");
CREATE INDEX "DeviceAvailabilityPeriod_device_id_ended_at_idx"
  ON "DeviceAvailabilityPeriod"("device_id", "ended_at");
CREATE UNIQUE INDEX "DeviceAvailabilityPeriod_device_id_started_at_ended_at_key"
  ON "DeviceAvailabilityPeriod"("device_id", "started_at", "ended_at");

ALTER TABLE "DeviceAvailabilityPeriod"
  ADD CONSTRAINT "DeviceAvailabilityPeriod_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
