CREATE TABLE IF NOT EXISTS "Liabilities" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Name" text NOT NULL,
    "Lender" text NOT NULL,
    "Balance" double precision NOT NULL,
    "MonthlyPayment" double precision NOT NULL,
    "InterestRate" double precision,
    "DueDay" integer,
    "Provenance" text NOT NULL,
    "LastUpdated" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Liabilities_EntityId" ON "Liabilities" ("EntityId");
