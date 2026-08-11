ALTER TABLE "Device"
ADD COLUMN "restart_requested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "last_command" TEXT,
ADD COLUMN "last_command_status" TEXT,
ADD COLUMN "last_command_at" TIMESTAMP(3);
