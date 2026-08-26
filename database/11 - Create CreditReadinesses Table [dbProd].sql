CREATE TABLE IF NOT EXISTS "CreditReadinesses" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Level" text NOT NULL,
    "IncomeMonthly" double precision NOT NULL,
    "ExpensesMonthly" double precision NOT NULL,
    "MonthlySurplus" double precision NOT NULL,
    "LiquidAssets" double precision NOT NULL,
    "Investments" double precision NOT NULL,
    "Liabilities" double precision NOT NULL,
    "DebtBurdenRatio" double precision NOT NULL,
    "SavingsConsistency" double precision NOT NULL,
    "HistoryMonths" integer NOT NULL,
    "NotesJson" text NOT NULL,
    "Disclaimer" text NOT NULL,
    "LastUpdated" timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_CreditReadinesses_EntityId" ON "CreditReadinesses" ("EntityId");
