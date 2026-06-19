# SILKILINEN — Agent System Map

A living map of the autonomous team: who senses, who decides, who makes, who
doubts, and how everything flows into **Archivarius** (memory) so the house gets
wiser instead of repeating itself.

> Read top-to-bottom as a chain of trust: **Sensors** gather reality →
> **Brains** decide → **Makers** produce → **Auditors** doubt all of it against
> ground truth → **Archivarius** remembers what was learned and caught, and
> feeds it back to everyone next cycle.

---

## 1. Brains — decide & direct
| Agent | Role | Reads | Produces |
|---|---|---|---|
| **Da Vinci** | The conductor — orchestrates the cycle above the Chief | every agent's output | the run/orchestration |
| **Chief of Staff** | The brain of the Growth Engine — the weekly honest state-of-the-business brief | DB (orders, visits, **products**), Search Console, clickstream, clerks' verdict | the **Weekly Brief** |
| **Marketing Coordinator** | Lead of the marketing team — turns the brief into a weekly plan | Chief brief, agent outputs | the **Weekly Plan** |

## 2. Sensors — gather reality (mostly data, low hallucination risk)
| Agent | Watches |
|---|---|
| **Watchdog** | Daily health: stock, listings, Merchant Center, fulfilment, reviews — *pure data, no AI* |
| **Demand Scout** | Real Google search demand (autocomplete + Trends) vs your ranking |
| **Hermes** | Senior search strategist — Search Console data, intent, live SERP |
| **Competitor Scout** | One competitor/run vs your real catalogue |
| **Storefront Scout** | A competitor's site + yours → concrete UX/conversion steals |

## 3. Makers — produce content & assets
| Agent | Makes |
|---|---|
| **Content Writer** | One SEO journal draft/week, linking real products |
| **Journal Writer** | On-demand "masterpiece" articles, intelligence-fused |
| **Social Drafter** | Instagram + Pinterest captions for fresh products/articles |
| **Newsletter Drafter** | Weekly newsletter |
| **Eureka** | Invents brand-new tools the brand could own (pattern combos) |

## 4. Atelier — the storefront-experience house
| Agent | Role |
|---|---|
| **Atelier (lead)** | AI creative director — appraises the storefront room-by-room (quiet-luxury bar) |
| **Atelier Critics** | Deterministic craft checks the eye can't measure (palette, speed, etc.) |
| **Maui** | Finds flat, boring moments where a reveal/motion would lift it |
| **Prometheus** | Walks the store as a first-timer — flags confusing/jargon/dealbreaker moments |

## 5. Auditors — the doubters (the immune system)
| Agent | Audits | Method |
|---|---|---|
| **Logic Clerk** | every *growth agent's* output, as a hashed chain vs ground truth | LLM + live catalogue/price facts |
| **Reasoning Clerk** | the agents' claims, fact-by-fact | LLM |
| **Ground-Truth Auditor** ✦ *new* | the **Chief brief** (and reusable for any agent) vs the live DB | **deterministic — no LLM** |

## 6. Advisory & memory
| Agent | Role |
|---|---|
| **Advisor / Advisor Digest** | The prioritised "what to do next to grow" list + weekly digest |
| **Analyst** | "Ask your store" — NL questions answered over live data |
| **Archivarius** | 📚 The living memory — lessons, pitfalls, facts, decisions |

---

## The trust & learning loop
```
 Sensors ─▶ Brains ─▶ Makers
    │          │         │
    └──────────┴─────────┴──▶  AUDITORS (Logic Clerk · Reasoning Clerk · Ground-Truth Auditor)
                                       │  catch contradictions vs the live DB
                                       ▼
                                 ARCHIVARIUS  (remembers every lesson + pitfall)
                                       │
                                       └──▶ fed back into every agent's prompt next cycle
```

---

## Improvements spotted while mapping

1. **Nobody used to audit the Chief.** The Logic Clerk treated the Chief brief as
   *ground truth* and used it to judge the workers — so a Chief error could even
   make it flag a *correct* worker. **Fixed:** the new deterministic Ground-Truth
   Auditor now checks the brief against the DB and files catches to Archivarius.

2. **Two clerks with fuzzy borders** (Logic Clerk *and* Reasoning Clerk). They
   overlap. Worth either (a) giving them clearly distinct beats — Logic Clerk =
   *internal consistency of the chain*, Reasoning Clerk = *evidence behind each
   claim* — or (b) merging them. Right now it's unclear who owns what.

3. **The Ground-Truth Auditor should guard more than the Chief.** It's reusable.
   The highest-value next hooks: the **Marketing Coordinator's plan**, the
   **Analyst's answers** ("Ask your store"), and the **Makers** before publish —
   so no agent can state a number/fact that fights the database.

4. **Make sure every agent *reads* Archivarius before acting.** Memory only
   prevents repeats if the makers/brains load Archivarius' pitfalls into their
   prompt *before* producing. Audit each agent for a `memoryBlock()` read; any
   that don't are doomed to relearn the same lessons.

5. **Deterministic > another LLM for facts.** The cheap, reliable wins are
   data-reconciliation gates (like the Watchdog and the Ground-Truth Auditor),
   not more LLM opinions — LLMs checking LLMs compound hallucination.
