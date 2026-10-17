-- Rename the 'developer' user role to 'manager'. RENAME VALUE (PG10+) rewrites
-- the enum label in place, so every existing row that referenced 'developer'
-- now reads 'manager' with no data migration needed.
ALTER TYPE "UserRole" RENAME VALUE 'developer' TO 'manager';
