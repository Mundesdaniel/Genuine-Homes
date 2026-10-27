-- Remove the 'landlord' user role. The landlord is no longer a platform user:
-- the agent owns the property record and is the sole intermediary, and the
-- landlord's name (+ optional photo) is stored on the property instead.

-- 1. New property columns for the landlord. Added nullable so existing rows
--    survive the backfill below; `landlord_name` is then made NOT NULL.
ALTER TABLE "properties" ADD COLUMN "landlord_name" TEXT;
ALTER TABLE "properties" ADD COLUMN "landlord_image_url" TEXT;

-- 2. Backfill a landlord name for every existing property (prefer the public
--    "listed by" contact, then the owner's account name, then a safe fallback).
UPDATE "properties" p
   SET "landlord_name" = COALESCE(p."contact_name", u."full_name", 'Owner')
  FROM "users" u
 WHERE p."owner_id" = u."id" AND p."landlord_name" IS NULL;
UPDATE "properties"
   SET "landlord_name" = 'Owner'
 WHERE "landlord_name" IS NULL;
ALTER TABLE "properties" ALTER COLUMN "landlord_name" SET NOT NULL;

-- 3. Convert any remaining landlord users to agents so no account is orphaned
--    and property ownership (owner_id FKs) stays intact.
UPDATE "users" SET "role" = 'agent' WHERE "role" = 'landlord';

-- 4. Drop 'landlord' from the enum. Postgres can't DROP VALUE, so recreate the
--    type. The column default must be dropped before the type swap and re-added.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('user', 'agent', 'airbnb_agent', 'manager', 'admin');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
DROP TYPE "UserRole_old";
