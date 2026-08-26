CREATE TABLE IF NOT EXISTS "SurplusConfigs" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "LiquidBalanceOverride" double precision,
    "EmergencyBufferOverride" double precision,
    "DiscretionarySpendRatio" double precision NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_SurplusConfigs_EntityId" ON "SurplusConfigs" ("EntityId");
