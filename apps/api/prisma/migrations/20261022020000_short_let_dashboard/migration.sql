-- CreateEnum
CREATE TYPE "ShortLetBookingStatus" AS ENUM ('booked', 'cancelled');

-- AlterTable: flag listings as short-let (price read as per-night).
ALTER TABLE "listings" ADD COLUMN "is_short_let" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "short_let_bookings" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'UGX',
    "guest_name" TEXT,
    "status" "ShortLetBookingStatus" NOT NULL DEFAULT 'booked',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "short_let_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_let_availability_blocks" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "short_let_availability_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "short_let_bookings_listing_id_idx" ON "short_let_bookings"("listing_id");

-- CreateIndex
CREATE INDEX "short_let_bookings_listing_id_check_in_idx" ON "short_let_bookings"("listing_id", "check_in");

-- CreateIndex
CREATE INDEX "short_let_availability_blocks_listing_id_idx" ON "short_let_availability_blocks"("listing_id");

-- CreateIndex
CREATE INDEX "short_let_availability_blocks_listing_id_start_date_idx" ON "short_let_availability_blocks"("listing_id", "start_date");

-- AddForeignKey
ALTER TABLE "short_let_bookings" ADD CONSTRAINT "short_let_bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "short_let_availability_blocks" ADD CONSTRAINT "short_let_availability_blocks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
