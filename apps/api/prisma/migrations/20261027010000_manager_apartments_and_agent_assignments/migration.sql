-- A manager runs a whole apartment (one multi-unit property) and can assign
-- agents to help handle its units/tenants.

-- Number of units in a multi-unit property (null for single-unit ones).
ALTER TABLE "properties" ADD COLUMN "unit_count" INTEGER;

-- Agents assigned to a property by its owner/manager. Assigned agents can handle
-- the property's viewing requests; the owner still owns the record.
CREATE TABLE "property_assignments" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "property_assignments_property_id_agent_id_key"
    ON "property_assignments" ("property_id", "agent_id");
CREATE INDEX "property_assignments_agent_id_idx"
    ON "property_assignments" ("agent_id");

ALTER TABLE "property_assignments"
    ADD CONSTRAINT "property_assignments_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_assignments"
    ADD CONSTRAINT "property_assignments_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
