CREATE TABLE IF NOT EXISTS "Goals" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Name" text NOT NULL,
    "Category" text NOT NULL,
    "Target" double precision NOT NULL,
    "Current" double precision NOT NULL,
    "Deadline" timestamptz NOT NULL,
    "MonthlyContribution" double precision NOT NULL,
    "Priority" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Goals_EntityId" ON "Goals" ("EntityId");
