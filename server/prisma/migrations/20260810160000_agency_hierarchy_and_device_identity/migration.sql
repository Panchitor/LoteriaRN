ALTER TABLE "Agency" ADD COLUMN "parent_id" TEXT;
ALTER TABLE "Agency" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Device" ADD COLUMN "installation_id" TEXT;
ALTER TABLE "Device" ADD COLUMN "api_token_hash" TEXT;
ALTER TABLE "Device" ADD COLUMN "revoked_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "agency_id" TEXT;

CREATE UNIQUE INDEX "Device_installation_id_key" ON "Device"("installation_id");
CREATE INDEX "Agency_parent_id_idx" ON "Agency"("parent_id");
CREATE INDEX "User_agency_id_idx" ON "User"("agency_id");

ALTER TABLE "Agency" ADD CONSTRAINT "Agency_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_agency_id_fkey"
  FOREIGN KEY ("agency_id") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
