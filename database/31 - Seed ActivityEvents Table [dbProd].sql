INSERT INTO "ActivityEvents" ("Id", "EntityId", "Timestamp", "Title", "Detail", "Kind") VALUES
('act-1', 'ent-personal', '2026-08-13T17:40:00Z', 'Surplus recalculated', 'Safe-to-invest updated after obligation scan', 'analysis'),
('act-2', 'ent-personal', '2026-08-12T14:00:00Z', 'Goal progress', 'Emergency Fund +KES 15,000 from MMF allocation', 'goal'),
('act-3', 'ent-business', '2026-08-11T11:00:00Z', 'Manual account updated', 'KCB Business balance refreshed by user', 'connection')
ON CONFLICT ("Id") DO NOTHING;
