DROP INDEX IF EXISTS "Agency_number_key";

ALTER TABLE "Agency" ADD COLUMN "code" TEXT;
ALTER TABLE "Agency" ADD COLUMN "subagency_number" INTEGER;
ALTER TABLE "Agency" ADD COLUMN "city" TEXT;
ALTER TABLE "Device" ADD COLUMN "tv_number" INTEGER;

UPDATE "Agency" SET "code" = "number"::TEXT WHERE "code" IS NULL;

WITH numbered_devices AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "agency_id" ORDER BY "created_at", "id") AS rn
  FROM "Device"
)
UPDATE "Device" d SET "tv_number" = n.rn
FROM numbered_devices n
WHERE d."id" = n."id" AND d."tv_number" IS NULL;

ALTER TABLE "Agency" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Agency_code_key" ON "Agency"("code");
CREATE INDEX "Agency_number_subagency_number_idx" ON "Agency"("number", "subagency_number");
CREATE UNIQUE INDEX "Device_agency_id_tv_number_key" ON "Device"("agency_id", "tv_number");
