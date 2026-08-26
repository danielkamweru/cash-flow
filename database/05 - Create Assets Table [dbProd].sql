CREATE TABLE IF NOT EXISTS "Assets" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Name" text NOT NULL,
    "Category" text NOT NULL,
    "Value" double precision NOT NULL,
    "Liquidity" text NOT NULL,
    "Provenance" text NOT NULL,
    "LastUpdated" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Assets_EntityId" ON "Assets" ("EntityId");
