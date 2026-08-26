CREATE TABLE IF NOT EXISTS "Users" (
    "Id" text PRIMARY KEY,
    "Name" text NOT NULL,
    "Email" text NOT NULL,
    "Phone" text,
    "Location" text,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Email" ON "Users" ("Email");
