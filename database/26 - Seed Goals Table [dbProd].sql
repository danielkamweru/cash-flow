INSERT INTO "Goals" ("Id", "EntityId", "Name", "Category", "Target", "Current", "Deadline", "MonthlyContribution", "Priority") VALUES
('goal-emergency', 'ent-personal', 'Emergency Fund', 'emergency', 300000, 120000, '2026-12-31', 20000, 1),
('goal-laptop', 'ent-personal', 'Replacement laptop', 'purchase', 150000, 45000, '2027-03-01', 10000, 3),
('goal-land', 'ent-personal', 'Land deposit', 'property', 800000, 95000, '2028-06-01', 25000, 4),
('goal-expansion', 'ent-business', 'Workshop expansion', 'business', 500000, 140000, '2027-06-01', 30000, 1)
ON CONFLICT ("Id") DO NOTHING;
