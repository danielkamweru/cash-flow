INSERT INTO "SurplusConfigs" ("Id", "EntityId", "LiquidBalanceOverride", "EmergencyBufferOverride", "DiscretionarySpendRatio") VALUES
('surplus-personal', 'ent-personal', 85000, 20000, 0.3333333333333333),
('surplus-business', 'ent-business', NULL, 40000, 0.3)
ON CONFLICT ("EntityId") DO NOTHING;
