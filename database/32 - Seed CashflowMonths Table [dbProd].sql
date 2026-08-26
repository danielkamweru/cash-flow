INSERT INTO "CashflowMonths" ("Id", "EntityId", "Month", "Year", "SortOrder", "Inflow", "Outflow") VALUES
('cf-personal-mar', 'ent-personal', 'Mar', 2026, 1, 145000, 110000),
('cf-personal-apr', 'ent-personal', 'Apr', 2026, 2, 145000, 118000),
('cf-personal-may', 'ent-personal', 'May', 2026, 3, 152000, 105000),
('cf-personal-jun', 'ent-personal', 'Jun', 2026, 4, 145000, 122000),
('cf-personal-jul', 'ent-personal', 'Jul', 2026, 5, 145000, 101000),
('cf-personal-aug', 'ent-personal', 'Aug', 2026, 6, 145000, 84900),
('cf-business-mar', 'ent-business', 'Mar', 2026, 1, 180000, 160000),
('cf-business-apr', 'ent-business', 'Apr', 2026, 2, 195000, 170000),
('cf-business-may', 'ent-business', 'May', 2026, 3, 210000, 155000),
('cf-business-jun', 'ent-business', 'Jun', 2026, 4, 175000, 168000),
('cf-business-jul', 'ent-business', 'Jul', 2026, 5, 230000, 190000),
('cf-business-aug', 'ent-business', 'Aug', 2026, 6, 78000, 50500)
ON CONFLICT ("EntityId", "Year", "Month") DO NOTHING;
