INSERT INTO "MarketInstruments" ("Id", "Type", "Name", "Provider", "YieldLabel", "YieldValue", "Risk", "Liquidity", "MinInvestment", "DataStatus", "AsOf", "Notes") VALUES
('mkt-mmf-1', 'mmf', 'Sample MMF A', 'Demo provider', 'Illustrative 7-day yield', '11.2% p.a.', 'low', 'T+1 (typical)', 1000, 'demo', '2026-08-13T17:40:00Z', 'Demo comparison only — not a live quote.'),
('mkt-mmf-2', 'mmf', 'Sample MMF B', 'Demo provider', 'Illustrative 7-day yield', '10.8% p.a.', 'low', 'T+1 (typical)', 500, 'sample', '2026-08-13T17:40:00Z', NULL),
('mkt-nse-1', 'nse', 'Sample equity basket', 'NSE (feed not connected)', 'Data', 'Unavailable', 'elevated', 'T+2', 5000, 'unavailable', NULL, 'Live NSE prices require a market data integration.'),
('mkt-tbill', 'tbill', '91-day T-Bill (illustrative)', 'CBK / DhowCSD', 'Sample accepted yield', '9.4%', 'low', 'Until maturity / secondary', 100000, 'simulated', '2026-08-01', 'Simulated auction figure for product demo.'),
('mkt-tbond', 'tbond', 'Infrastructure bond (illustrative)', 'CBK', 'Sample coupon', '13.5%', 'moderate', 'Secondary market', 50000, 'sample', '2026-07-01', NULL)
ON CONFLICT ("Id") DO NOTHING;
