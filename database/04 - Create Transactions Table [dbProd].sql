CREATE TABLE IF NOT EXISTS "Transactions" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "AccountId" text NOT NULL REFERENCES "Accounts" ("Id") ON DELETE CASCADE,
    "Date" timestamptz NOT NULL,
    "Description" text NOT NULL,
    "Amount" double precision NOT NULL,
    "Category" text NOT NULL,
    "Type" text NOT NULL,
    "Provenance" text NOT NULL,
    "CreatedAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Transactions_EntityId_Date" ON "Transactions" ("EntityId", "Date");
CREATE INDEX IF NOT EXISTS "IX_Transactions_AccountId" ON "Transactions" ("AccountId");
