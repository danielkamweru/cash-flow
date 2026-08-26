-- Automation engine: structured rule specs + run history (dbProd parity with backend/app/db.py + models.py)
ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "TriggerSpec" jsonb;
ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "ActionSpec" jsonb;
ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "AutoApprove" boolean NOT NULL DEFAULT false;
ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "LastRunAt" timestamptz;
ALTER TABLE "AutomationRules" ADD COLUMN IF NOT EXISTS "NextRunAt" timestamptz;

CREATE TABLE IF NOT EXISTS "RuleRuns" (
    "Id" text PRIMARY KEY,
    "RuleId" text NOT NULL REFERENCES "AutomationRules" ("Id") ON DELETE CASCADE,
    "EntityId" text NOT NULL REFERENCES "Entities" ("Id") ON DELETE CASCADE,
    "TriggeredAt" timestamptz NOT NULL,
    "Outcome" text NOT NULL,
    "RunMode" text NOT NULL DEFAULT 'simulated',
    "ProposedAmount" double precision,
    "TxnReference" text,
    "Error" text,
    "Detail" text
);
CREATE INDEX IF NOT EXISTS "IX_RuleRuns_RuleId" ON "RuleRuns" ("RuleId");
CREATE INDEX IF NOT EXISTS "IX_RuleRuns_EntityId" ON "RuleRuns" ("EntityId");
