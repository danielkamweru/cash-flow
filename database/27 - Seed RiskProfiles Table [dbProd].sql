INSERT INTO "RiskProfiles" ("Id", "EntityId", "Horizon", "Tolerance", "EmergencyFundMonthsTarget", "Notes") VALUES
('risk-personal', 'ent-personal', 'medium', 'moderate', 3, 'Prefers liquidity with selective growth'),
('risk-business', 'ent-business', 'short', 'low', 2, 'Protect operating runway first')
ON CONFLICT ("EntityId") DO NOTHING;
