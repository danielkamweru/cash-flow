"""Advisory agents that read a user's books and produce explainable guidance.

Each agent is a specialist: it looks at one dimension of the picture (spending,
cash flow, emergency cover, debt, allocation) and emits findings with the
numbers behind them. A synthesizer then ranks everything into a prioritized
plan.

The reasoning is deterministic on purpose. This is money advice, so every
number a user sees has to be reproducible and traceable back to their own
transactions — not resampled from a generative model each time they load the
page. Agents surface the inputs they used in ``evidence`` so the UI can show
its work, and every recommendation carries the assumptions it rests on.
"""

from app.advisors.engine import AdvisorReport, run_advisors

__all__ = ["AdvisorReport", "run_advisors"]
