import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Layers,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const loopSteps = [
  "Understand",
  "Analyze",
  "Find surplus",
  "Set a goal",
  "Take action",
  "Track",
  "Improve",
];

export default function LandingPage() {
  return (
    <div className="wl-grid-bg min-h-dvh max-w-[100vw] overflow-x-clip text-wl-text">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-wl-primary to-wl-secondary sm:h-10 sm:w-10">
            <Sparkles className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight sm:text-xl">Wealth Loop</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-wl-muted">Kenya</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/signin" className="hidden text-sm text-wl-muted hover:text-wl-text sm:inline">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-wl-primary/30 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Sign up
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-4 sm:gap-10 sm:px-5 sm:pb-16 sm:pt-8 md:grid-cols-[1.15fr_0.85fr] md:items-center md:pt-14">
          <div className="animate-fade-up min-w-0">
            <p className="mb-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-wl-border bg-wl-surface/70 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-wl-secondary sm:text-[11px] sm:tracking-[0.16em]">
              Financial intelligence · Wealth orchestration
            </p>
            <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl md:text-6xl">
              Wealth Loop
            </h1>
            <p className="mt-4 max-w-xl text-base text-wl-text-secondary sm:text-lg md:text-xl">
              Turns fragmented Kenyan money — M-Pesa, banks, SACCOs, MMFs, NSE, Treasuries — into
              clear position, safe surplus, and explainable next actions.
            </p>
            <p className="mt-4 max-w-lg text-sm text-wl-muted">
              Not guaranteed returns. Not an MLM. A co-pilot for better decisions with money you
              already have.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-wl-text px-6 py-3 text-sm font-semibold text-wl-bg transition hover:bg-white sm:w-auto"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-wl-border px-6 py-3 text-sm font-medium text-wl-text hover:border-wl-secondary/50 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative min-w-0 animate-fade-up-delay-1">
            <div className="wl-card overflow-hidden p-1">
              <div className="rounded-[14px] bg-gradient-to-br from-[#1a1010] via-wl-surface to-[#1a1410] p-4 sm:p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-wl-muted">Demo snapshot</p>
                <p className="mt-2 font-display text-2xl font-semibold sm:text-3xl">KES 30,000</p>
                <p className="text-sm text-wl-secondary">Safe-to-invest surplus</p>
                <div className="mt-5 space-y-2 font-mono text-xs text-wl-text-secondary">
                  <div className="flex justify-between gap-3 border-b border-wl-border pb-2">
                    <span className="min-w-0">Liquid money</span>
                    <span className="shrink-0">85,000</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-wl-border pb-2">
                    <span className="min-w-0">Upcoming obligations</span>
                    <span className="shrink-0">−35,000</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-wl-border pb-2">
                    <span className="min-w-0">Emergency buffer</span>
                    <span className="shrink-0">−20,000</span>
                  </div>
                  <div className="flex justify-between gap-3 pt-1 font-semibold text-wl-text">
                    <span className="min-w-0">Safe surplus</span>
                    <span className="shrink-0">30,000</span>
                  </div>
                </div>
                <p className="mt-4 text-[11px] text-wl-muted">
                  Transparent calculation · last updated in demo dataset
                </p>
              </div>
            </div>
            <div className="relative mt-3 rounded-2xl border border-wl-border bg-wl-elevated px-4 py-3 shadow-xl animate-fade-up-delay-2 sm:absolute sm:-bottom-4 sm:-left-2 sm:mt-0 md:-left-4">
              <p className="text-[10px] uppercase tracking-wide text-wl-muted">Wealth Health</p>
              <p className="font-display text-lg font-semibold text-wl-secondary">GROWING</p>
            </div>
          </div>
        </section>

        <section className="border-y border-wl-border bg-wl-elevated/50 py-8 sm:py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 sm:px-5 md:gap-3">
            {loopSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2 md:gap-3">
                <span className="rounded-full border border-wl-border bg-wl-surface px-2.5 py-1.5 text-[11px] font-medium text-wl-text sm:px-3 sm:text-xs">
                  {step}
                </span>
                {i < loopSteps.length - 1 && (
                  <span className="hidden text-wl-muted sm:inline">→</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:gap-6 sm:px-5 sm:py-16 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Understand fragmentation",
              body: "Personal and business contexts stay separate — with a consolidated wealth view when you need the whole picture.",
              anim: "animate-fade-up-delay-1",
            },
            {
              icon: Workflow,
              title: "Surplus engine",
              body: "Safe surplus = liquid − obligations − emergency buffer. The UI explains why an amount is safe.",
              anim: "animate-fade-up-delay-2",
            },
            {
              icon: Shield,
              title: "Trust as a feature",
              body: "Demo labels, provenance, last-updated stamps, and no fake money movement. Integrations are honest about status.",
              anim: "animate-fade-up-delay-3",
            },
          ].map((f) => (
            <article key={f.title} className={`wl-card p-5 sm:p-6 ${f.anim}`}>
              <f.icon className="mb-4 h-6 w-6 text-wl-secondary" />
              <h2 className="font-display text-lg font-semibold sm:text-xl">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-wl-muted">{f.body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-5 sm:pb-20">
          <div className="wl-card grid gap-6 p-5 sm:gap-8 sm:p-8 md:grid-cols-2 md:p-10">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold sm:text-2xl md:text-3xl">
                Built for today. Ready for Kenya&apos;s rails tomorrow.
              </h2>
              <p className="mt-3 text-sm text-wl-muted">
                Manual accounts and demo market data now. Provider adapters for M-Pesa, banks, MMFs,
                NSE, and CBK/DhowCSD later — without rewriting the product thesis.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-wl-text-secondary">
                {[
                  "Explainable recommendations",
                  "Wealth Health (not CRB)",
                  "Credit readiness profiles",
                  "User-approved automation roadmap",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-wl-success" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-wl-border bg-[var(--wealth-inset)] p-6">
              <p className="text-sm leading-relaxed text-wl-text-secondary">
                “How can we help users make better financial decisions with the money they already
                have?” — that is the heart of Wealth Loop.
              </p>
              <Link
                href="/dashboard"
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-wl-primary to-wl-secondary px-5 py-3 text-sm font-semibold text-white"
              >
                Open the dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <p className="mt-8 text-center text-[11px] text-wl-muted">
            NCPA brand colour tokens are reserved as{" "}
            <code className="text-ncpa-secondary">--ncpa-primary</code> /{" "}
            <code className="text-ncpa-secondary">--ncpa-secondary</code> pending official assets.
          </p>
        </section>
      </main>
    </div>
  );
}
