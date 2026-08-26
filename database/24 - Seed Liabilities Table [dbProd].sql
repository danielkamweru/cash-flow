INSERT INTO "Liabilities" ("Id", "EntityId", "Name", "Lender", "Balance", "MonthlyPayment", "InterestRate", "DueDay", "Provenance", "LastUpdated") VALUES
('liab-fuliza', 'ent-personal', 'Fuliza / short-term mobile credit', 'Safaricom', 4200, 4200, NULL, NULL, 'demo', '2026-08-13T17:40:00Z'),
('liab-phone', 'ent-personal', 'Device financing', 'Bank', 28000, 4500, 13, 5, 'user_entered', now()),
('liab-biz-loan', 'ent-business', 'Working capital loan', 'KCB', 180000, 18500, 14.5, 28, 'user_entered', now())
ON CONFLICT ("Id") DO NOTHING;
