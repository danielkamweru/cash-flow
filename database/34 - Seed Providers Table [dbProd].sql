INSERT INTO "Providers" ("Id", "Slug", "Name", "Category", "Status", "Description", "Capabilities") VALUES
('mpesa', 'mpesa', 'M-Pesa', 'mpesa', 'demo', 'Mobile money balances and transaction history.', '["balances","transactions"]'),
('equity-bank', 'equity-bank', 'Equity Bank', 'bank', 'manual', 'Bank account balances via statement upload or Open Banking (future).', '["balances","transactions","statements"]'),
('kcb', 'kcb', 'KCB', 'bank', 'coming_soon', 'Bank API / Open Banking connection — not live in this build.', '["balances","transactions"]'),
('sacco-generic', 'sacco-generic', 'SACCO (manual)', 'sacco', 'manual', 'Member deposits and shares entered manually until SACCO APIs exist.', '["balances"]'),
('mmf-aggregate', 'mmf-aggregate', 'Money Market Funds', 'mmf', 'demo', 'MMF holdings and illustrative yield comparison (demo data).', '["holdings","yields"]'),
('nse', 'nse', 'NSE', 'nse', 'coming_soon', 'Listed equities market data feed — placeholder for future integration.', '["prices","holdings"]'),
('cbk-dhowcsd', 'cbk-dhowcsd', 'CBK / DhowCSD', 'treasury', 'coming_soon', 'Treasury bills and bonds — integration required.', '["auctions","holdings"]')
ON CONFLICT ("Slug") DO NOTHING;
