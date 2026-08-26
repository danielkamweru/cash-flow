INSERT INTO "Accounts" ("Id", "EntityId", "Name", "Provider", "Institution", "Balance", "Currency", "ConnectionStatus", "Provenance", "AccountMask", "IsLiquid", "LastUpdated", "CreatedAt") VALUES
('acc-mpesa', 'ent-personal', 'M-Pesa', 'mpesa', 'Safaricom', 24500, 'KES', 'demo', 'demo', '••• 4481', true, '2026-08-13T17:40:00Z', now()),
('acc-equity', 'ent-personal', 'Equity Current', 'bank', 'Equity Bank', 48200, 'KES', 'manual', 'user_entered', '••• 9021', true, '2026-08-12T09:00:00Z', now()),
('acc-cash', 'ent-personal', 'Cash on hand', 'cash', 'Self', 12300, 'KES', 'manual', 'user_entered', NULL, true, '2026-08-13T08:00:00Z', now()),
('acc-sacco', 'ent-personal', 'Workplace SACCO', 'sacco', 'Umoja SACCO', 95000, 'KES', 'manual', 'user_entered', NULL, false, '2026-08-01T12:00:00Z', now()),
('acc-biz-kcb', 'ent-business', 'KCB Business', 'bank', 'KCB', 186400, 'KES', 'manual', 'user_entered', '••• 3310', true, '2026-08-13T10:00:00Z', now()),
('acc-biz-mpesa', 'ent-business', 'Till / Paybill float', 'mpesa', 'Safaricom', 42800, 'KES', 'demo', 'demo', NULL, true, '2026-08-13T17:40:00Z', now())
ON CONFLICT ("Id") DO NOTHING;
