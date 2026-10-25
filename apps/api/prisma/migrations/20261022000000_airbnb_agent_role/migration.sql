-- Add the short-let ("AirBnB") agent role. `ADD VALUE` is safe here (PG12+):
-- the new value is only added, never used in this same migration transaction.
-- Placed before 'manager' to match the enum order declared in schema.prisma.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'airbnb_agent' BEFORE 'manager';
