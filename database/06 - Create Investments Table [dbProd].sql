CREATE TABLE IF NOT EXISTS "Investments" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Name" text NOT NULL,
    "Type" text NOT NULL,
    "Value" double precision NOT NULL,
    "CostBasis" double precision,
    "Liquidity" text NOT NULL,
    "Risk" text NOT NULL,
    "Provenance" text NOT NULL,
    "Notes" text,
    "LastUpdated" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Investments_EntityId" ON "Investments" ("EntityId");
