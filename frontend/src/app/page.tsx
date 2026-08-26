import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Layers,
  Shield,
  Sparkles,
  Workflow,
  TrendingUp,
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
    <div className="cf-grid-bg min-h-dvh max-w-[100vw] overflow-x-clip text-cf-text">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cf-primary to-cf-primary-deep sm:h-10 sm:w-10">
            <TrendingUp className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight sm:text-xl">Cash-Flow</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cf-muted">Kenya</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/signin" className="hidden text-sm text-cf-muted hover:text-cf-text sm:inline">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-cf-primary/30 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Sign up
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-4 sm:gap-10 sm:px-5 sm:pb-16 sm:pt-8 md:grid-cols-[1.15fr_0.85fr] md:items-center md:pt-14">
          <div className="animate-fade-up min-w-0">
            <p className="mb-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-cf-border bg-cf-surface/70 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-cf-primary sm:text-[11px] sm:tracking-[0.16em]">
              Personal finance · Made for Kenya
            </p>
            <h1 className="font-display text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl md:text-6xl">
              Cash-Flow
            </h1>
            <p className="mt-4 max-w-xl text-base text-cf-text-secondary sm:text-lg md:text-xl">
              Understand your money. Control your flow. Track income, expenses, savings, and goals — all in one clear view.
            </p>
            <p className="mt-4 max-w-lg text-sm text-cf-muted">
              Not guaranteed returns. Not an MLM. A clear view of your money with the actions that matter.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-cf-text px-6 py-3 text-sm font-semibold text-cf-bg transition hover:opacity-90 sm:w-auto"
              >
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signin"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cf-border px-6 py-3 text-sm font-medium text-cf-text hover:border-cf-primary/50 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative min-w-0 animate-fade-up-delay-1">
            <div className="cf-card overflow-hidden p-1">
              <div className="rounded-[14px] bg-gradient-to-br from-cf-surface via-cf-surface to-cf-surface-2 p-4 sm:p-6">
                <p className="text-[11px] uppercase tracking-[0.16em] text-cf-muted">Demo snapshot</p>
                <p className="mt-2 font-display text-2xl font-semibold sm:text-3xl">KES 30,000</p>
                <p className="text-sm text-cf-primary">Safe-to-invest surplus</p>
                <div className="mt-5 space-y-2 font-mono text-xs text-cf-text-secondary">
                  <div className="flex justify-between gap-3 border-b border-cf-border pb-2">
                    <span className="min-w-0">Liquid money</span>
                    <span className="shrink-0">85,000</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-cf-border pb-2">
                    <span className="min-w-0">Upcoming obligations</span>
                    <span className="shrink-0">−35,000</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-cf-border pb-2">
                    <span className="min-w-0">Emergency buffer</span>
                    <span className="shrink-0">−20,000</span>
                  </div>
                  <div className="flex justify-between gap-3 pt-1 font-semibold text-cf-text">
                    <span className="min-w-0">Safe surplus</span>
                    <span className="shrink-0">30,000</span>
                  </div>
                </div>
                <p className="mt-4 text-[11px] text-cf-muted">
                  Transparent calculation · last updated in demo dataset
                </p>
              </div>
            </div>
            <div className="relative mt-3 rounded-2xl border border-cf-border bg-cf-elevated px-4 py-3 shadow-xl animate-fade-up-delay-2 sm:absolute sm:-bottom-4 sm:-left-2 sm:mt-0 md:-left-4">
              <p className="text-[10px] uppercase tracking-wide text-cf-muted">Wealth Health</p>
              <p className="font-display text-lg font-semibold text-cf-primary">GROWING</p>
            </div>
          </div>
        </section>

        <section className="border-y border-cf-border bg-cf-elevated/50 py-8 sm:py-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 sm:px-5 md:gap-3">
            {loopSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2 md:gap-3">
                <span className="rounded-full border border-cf-border bg-cf-surface px-2.5 py-1.5 text-[11px] font-medium text-cf-text sm:px-3 sm:text-xs">
                  {step}
                </span>
                {i < loopSteps.length - 1 && (
                  <span className="hidden text-cf-muted sm:inline">→</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:gap-6 sm:px-5 sm:py-16 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "See everything",
              body: "Personal and business contexts stay separate — with a consolidated wealth view when you need the whole picture.",
              anim: "animate-fade-up-delay-1",
            },
            {
              icon: Workflow,
              title: "Know your surplus",
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
            <article key={f.title} className={`cf-card p-5 sm:p-6 ${f.anim}`}>
              <f.icon className="mb-4 h-6 w-6 text-cf-primary" />
              <h2 className="font-display text-lg font-semibold sm:text-xl">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-cf-muted">{f.body}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-5 sm:pb-20">
          <div className="cf-card grid gap-6 p-5 sm:gap-8 sm:p-8 md:grid-cols-2 md:p-10">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold sm:text-2xl md:text-3xl">
                Built for today. Ready for Kenya&apos;s rails tomorrow.
              </h2>
              <p className="mt-3 text-sm text-cf-muted">
                Manual accounts and demo market data now. Provider adapters for M-Pesa, banks, MMFs,
                NSE, and CBK/DhowCSD later — without rewriting the product thesis.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-cf-text-secondary">
                {[
                  "Explainable recommendations",
                  "Wealth Health (not CRB)",
                  "Credit readiness profiles",
                  "User-approved automation roadmap",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cf-success" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-cf-border bg-[var(--cf-inset)] p-6">
              <p className="text-sm leading-relaxed text-cf-text-secondary">
                &ldquo;How can we help users make better financial decisions with the money they already
                have?&rdquo; — that is the heart of Cash-Flow.
              </p>
              <Link
                href="/dashboard"
                className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-cf-primary to-cf-primary-deep px-5 py-3 text-sm font-semibold text-white"
              >
                Open the dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
