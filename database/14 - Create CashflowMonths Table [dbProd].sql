CREATE TABLE IF NOT EXISTS "CashflowMonths" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Month" text NOT NULL,
    "Year" integer NOT NULL,
    "SortOrder" integer NOT NULL,
    "Inflow" double precision NOT NULL,
    "Outflow" double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_CashflowMonths_EntityId" ON "CashflowMonths" ("EntityId");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_CashflowMonths_EntityId_Year_Month" ON "CashflowMonths" ("EntityId", "Year", "Month");
