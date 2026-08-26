CREATE TABLE IF NOT EXISTS "RiskProfiles" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Horizon" text NOT NULL,
    "Tolerance" text NOT NULL,
    "EmergencyFundMonthsTarget" integer NOT NULL,
    "Notes" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_RiskProfiles_EntityId" ON "RiskProfiles" ("EntityId");
