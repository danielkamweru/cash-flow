CREATE TABLE IF NOT EXISTS "Obligations" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Name" text NOT NULL,
    "Amount" double precision NOT NULL,
    "DueDate" timestamptz NOT NULL,
    "Category" text NOT NULL,
    "Status" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Obligations_EntityId_Status" ON "Obligations" ("EntityId", "Status");
