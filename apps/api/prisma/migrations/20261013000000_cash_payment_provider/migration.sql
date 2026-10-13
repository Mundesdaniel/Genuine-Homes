-- Add the `cash` payment method. Paid in person; recorded pending until the
-- property owner confirms receipt. `ADD VALUE` is safe here (PG12+): the new
-- value is only added, never used in this same migration transaction.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'cash';
