CREATE TABLE IF NOT EXISTS "MarketInstruments" (
    "Id" text PRIMARY KEY,
    "Type" text NOT NULL,
    "Name" text NOT NULL,
    "Provider" text NOT NULL,
    "YieldLabel" text NOT NULL,
    "YieldValue" text NOT NULL,
    "Risk" text NOT NULL,
    "Liquidity" text NOT NULL,
    "MinInvestment" double precision NOT NULL,
    "DataStatus" text NOT NULL,
    "AsOf" timestamptz,
    "Notes" text
);
