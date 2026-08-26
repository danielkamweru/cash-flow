INSERT INTO "Assets" ("Id", "EntityId", "Name", "Category", "Value", "Liquidity", "Provenance", "LastUpdated") VALUES
('ast-laptop', 'ent-personal', 'Work laptop', 'Electronics', 85000, 'illiquid', 'estimated', now()),
('ast-furniture', 'ent-personal', 'Household goods', 'Home', 120000, 'illiquid', 'estimated', now()),
('ast-inventory', 'ent-business', 'Fabric inventory', 'Inventory', 210000, 'semi_liquid', 'estimated', now()),
('ast-equipment', 'ent-business', 'Sewing machines & tools', 'Equipment', 160000, 'illiquid', 'estimated', now())
ON CONFLICT ("Id") DO NOTHING;
