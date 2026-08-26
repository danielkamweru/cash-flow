INSERT INTO "Obligations" ("Id", "EntityId", "Name", "Amount", "DueDate", "Category", "Status") VALUES
('ob-rent', 'ent-personal', 'September rent', 35000, '2026-09-01', 'Housing', 'upcoming'),
('ob-school', 'ent-personal', 'School fees balance', 0, '2026-08-20', 'Education', 'paid'),
('ob-supplier', 'ent-business', 'Supplier invoice — cotton', 45000, '2026-08-20', 'Suppliers', 'upcoming'),
('ob-paye', 'ent-business', 'PAYE / statutory', 22000, '2026-08-09', 'Tax', 'upcoming')
ON CONFLICT ("Id") DO NOTHING;
