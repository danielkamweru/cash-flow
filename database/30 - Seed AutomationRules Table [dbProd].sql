INSERT INTO "AutomationRules" ("Id", "EntityId", "Name", "Description", "Status", "Trigger", "Action") VALUES
('auto-1', 'ent-personal', 'Payday surplus sweep', 'When salary lands, analyse obligations, protect emergency buffer, then propose routing safe surplus to your Emergency Fund.', 'awaiting_authorization', 'Income detected ≥ KES 50,000', 'Propose MMF / goal transfer (user approval required)'),
('auto-2', 'ent-business', 'Supplier buffer guard', 'Keep 1 month of supplier obligations liquid before any investment sweep.', 'coming_soon', 'Weekly cash-flow review', 'Block sweep if buffer breached')
ON CONFLICT ("Id") DO NOTHING;
