CREATE TABLE IF NOT EXISTS "Entities" (
    "Id" text PRIMARY KEY,
    "UserId" text NOT NULL REFERENCES "Users" ("Id") ON DELETE CASCADE,
    "Type" text NOT NULL,
    "Name" text NOT NULL,
    "Description" text,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_Entities_UserId_Type" ON "Entities" ("UserId", "Type");
