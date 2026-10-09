-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL,
    "message" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_buyer_id_idx" ON "bookings"("buyer_id");

-- CreateIndex
CREATE INDEX "bookings_owner_id_status_idx" ON "bookings"("owner_id", "status");

-- CreateIndex
CREATE INDEX "bookings_listing_id_idx" ON "bookings"("listing_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
