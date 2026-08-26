import type { ProviderDefinition } from "@/lib/types";

/**
 * Extensible provider registry.
 * Today: manual / demo. Tomorrow: M-Pesa, banks, MMF, NSE, CBK, SACCOs.
 */
export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "mpesa",
    name: "M-Pesa",
    category: "mpesa",
    status: "demo",
    description: "Mobile money balances and transaction history.",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "equity-bank",
    name: "Equity Bank",
    category: "bank",
    status: "manual",
    description: "Bank account balances via statement upload or Open Banking (future).",
    capabilities: ["balances", "transactions", "statements"],
  },
  {
    id: "kcb",
    name: "KCB",
    category: "bank",
    status: "coming_soon",
    description: "Bank API / Open Banking connection — not live in this build.",
    capabilities: ["balances", "transactions"],
  },
  {
    id: "sacco-generic",
    name: "SACCO (manual)",
    category: "sacco",
    status: "manual",
    description: "Member deposits and shares entered manually until SACCO APIs exist.",
    capabilities: ["balances"],
  },
  {
    id: "mmf-aggregate",
    name: "Money Market Funds",
    category: "mmf",
    status: "demo",
    description: "MMF holdings and illustrative yield comparison (demo data).",
    capabilities: ["holdings", "yields"],
  },
  {
    id: "nse",
    name: "NSE",
    category: "nse",
    status: "coming_soon",
    description: "Listed equities market data feed — placeholder for future integration.",
    capabilities: ["prices", "holdings"],
  },
  {
    id: "cbk-dhowcsd",
    name: "CBK / DhowCSD",
    category: "treasury",
    status: "coming_soon",
    description: "Treasury bills and bonds — integration required.",
    capabilities: ["auctions", "holdings"],
  },
];
