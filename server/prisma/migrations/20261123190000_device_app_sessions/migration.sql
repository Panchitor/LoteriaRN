CREATE TABLE "DeviceAppSession" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "end_reason" TEXT,
  "app_version" TEXT,
  CONSTRAINT "DeviceAppSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceAppSession_device_id_session_id_key"
  ON "DeviceAppSession"("device_id", "session_id");
CREATE INDEX "DeviceAppSession_device_id_started_at_idx"
  ON "DeviceAppSession"("device_id", "started_at");
CREATE INDEX "DeviceAppSession_device_id_ended_at_idx"
  ON "DeviceAppSession"("device_id", "ended_at");

ALTER TABLE "DeviceAppSession"
  ADD CONSTRAINT "DeviceAppSession_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
