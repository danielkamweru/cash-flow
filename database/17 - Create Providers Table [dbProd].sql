CREATE TABLE IF NOT EXISTS "Providers" (
    "Id" text PRIMARY KEY,
    "Slug" text NOT NULL,
    "Name" text NOT NULL,
    "Category" text NOT NULL,
    "Status" text NOT NULL,
    "Description" text NOT NULL,
    "Capabilities" text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Providers_Slug" ON "Providers" ("Slug");
