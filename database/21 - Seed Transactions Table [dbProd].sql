INSERT INTO "Transactions" ("Id", "EntityId", "AccountId", "Date", "Description", "Amount", "Category", "Type", "Provenance", "CreatedAt") VALUES
('tx-1', 'ent-personal', 'acc-equity', '2026-08-01', 'Salary — August', 145000, 'Income', 'inflow', 'demo', now()),
('tx-2', 'ent-personal', 'acc-mpesa', '2026-08-03', 'Rent — Kilimani', 35000, 'Housing', 'outflow', 'demo', now()),
('tx-3', 'ent-personal', 'acc-mpesa', '2026-08-05', 'Naivas groceries', 8400, 'Food', 'outflow', 'demo', now()),
('tx-4', 'ent-personal', 'acc-equity', '2026-08-06', 'MMF top-up — CIC', 15000, 'Invest / Save', 'outflow', 'demo', now()),
('tx-5', 'ent-personal', 'acc-mpesa', '2026-08-08', 'School fees installment', 12000, 'Education', 'outflow', 'demo', now()),
('tx-6', 'ent-personal', 'acc-equity', '2026-08-10', 'SACCO contribution', 10000, 'Invest / Save', 'outflow', 'user_entered', now()),
('tx-7', 'ent-business', 'acc-biz-kcb', '2026-08-04', 'Client payment — fabric order', 78000, 'Receivables', 'inflow', 'demo', now()),
('tx-8', 'ent-business', 'acc-biz-mpesa', '2026-08-07', 'Supplier — dyes & thread', 22500, 'Suppliers', 'outflow', 'demo', now()),
('tx-9', 'ent-business', 'acc-biz-kcb', '2026-08-11', 'Workshop rent', 28000, 'Overheads', 'outflow', 'demo', now())
ON CONFLICT ("Id") DO NOTHING;
