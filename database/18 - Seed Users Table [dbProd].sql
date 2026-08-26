INSERT INTO "Users" ("Id", "Name", "Email", "Phone", "Location", "CreatedAt", "UpdatedAt") VALUES
('user-amina', 'Amina Otieno', 'amina@example.com', '+254 712 000 000', 'Nairobi, Kenya', now(), now())
ON CONFLICT ("Id") DO NOTHING;
