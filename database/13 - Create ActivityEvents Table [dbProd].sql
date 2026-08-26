CREATE TABLE IF NOT EXISTS "ActivityEvents" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Timestamp" timestamptz NOT NULL,
    "Title" text NOT NULL,
    "Detail" text NOT NULL,
    "Kind" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_ActivityEvents_EntityId_Timestamp" ON "ActivityEvents" ("EntityId", "Timestamp");
