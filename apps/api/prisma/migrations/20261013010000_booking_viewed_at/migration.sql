-- Records when a viewing was confirmed as actually having happened. A confirmed
-- viewing unlocks payment immediately (the buyer or owner presses "Confirm
-- viewing"), rather than waiting for the scheduled time to merely pass.
ALTER TABLE "bookings" ADD COLUMN "viewed_at" TIMESTAMPTZ(6);
