CREATE TABLE IF NOT EXISTS "Accounts" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Name" text NOT NULL,
    "Provider" text NOT NULL,
    "Institution" text NOT NULL,
    "Balance" double precision NOT NULL,
    "Currency" text NOT NULL,
    "ConnectionStatus" text NOT NULL,
    "Provenance" text NOT NULL,
    "AccountMask" text,
    "IsLiquid" boolean NOT NULL,
    "LastUpdated" timestamptz NOT NULL,
    "CreatedAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Accounts_EntityId" ON "Accounts" ("EntityId");
