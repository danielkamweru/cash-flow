INSERT INTO "Investments" ("Id", "EntityId", "Name", "Type", "Value", "CostBasis", "Liquidity", "Risk", "Provenance", "Notes", "LastUpdated") VALUES
('inv-mmf', 'ent-personal', 'CIC Money Market Fund', 'mmf', 142000, 130000, 'daily', 'low', 'demo', 'Demo holding — not a live fund feed', '2026-08-13T17:40:00Z'),
('inv-tbill', 'ent-personal', '91-day Treasury Bill', 'tbill', 100000, NULL, 'maturity', 'low', 'user_entered', 'Matures Oct 2026 (user-entered)', now()),
('inv-sacco-shares', 'ent-personal', 'SACCO shares', 'sacco', 60000, NULL, 'locked', 'moderate', 'user_entered', NULL, now()),
('inv-biz-mmf', 'ent-business', 'Business MMF reserve', 'mmf', 75000, NULL, 'daily', 'low', 'demo', 'Demo — operating reserve', '2026-08-13T17:40:00Z')
ON CONFLICT ("Id") DO NOTHING;
