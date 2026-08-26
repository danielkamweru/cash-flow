CREATE TABLE IF NOT EXISTS "AutomationRules" (
    "Id" text PRIMARY KEY,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "Name" text NOT NULL,
    "Description" text NOT NULL,
    "Status" text NOT NULL,
    "Trigger" text NOT NULL,
    "Action" text NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_AutomationRules_EntityId" ON "AutomationRules" ("EntityId");
