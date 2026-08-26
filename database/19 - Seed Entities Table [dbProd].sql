INSERT INTO "Entities" ("Id", "UserId", "Type", "Name", "Description", "CreatedAt", "UpdatedAt") VALUES
('ent-personal', 'user-amina', 'PERSONAL', 'Personal', 'Household cash, savings, investments, and family goals', now(), now()),
('ent-business', 'user-amina', 'BUSINESS', 'Business', 'Studio Kitenge — inventory, receivables, and operating cash', now(), now())
ON CONFLICT ("Id") DO NOTHING;
