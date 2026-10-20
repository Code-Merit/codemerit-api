# Financial Literacy — Sample Subject Test Guide

A deliberately tiny, real-content subject seeded to manually test the full quiz → self-assessment → automatic certificate-unlock flow end to end in about 10 minutes.

## Structure

**Subject**: `financial-literacy` — "Financial Literacy for Non-Finance Roles" (id 53). `isPremium` defaults to `true` (no seed field for it) — flip with `UPDATE subject SET isPremium = 0 WHERE slug = 'financial-literacy';` if your test account is blocked by premium gating.

**6 topics / 2 per subject track / 9 questions per topic (3 per level):**

| Track (sortOrder) | Topics |
|---|---|
| `financial-statements-foundations` (1) | `reading-the-big-three-financial-statements`, `core-financial-vocabulary` |
| `applied-business-finance` (2) | `profitability-cost-analysis`, `budgeting-forecasting-variance` |
| `financial-decision-making` (3) | `investment-appraisal-essentials`, `business-case-financial-risk-analysis` |

**Cumulative 3-tier certification ladder**, attached to job role `office-professional` (published `CertificationTrackJobRole` rows; note the `office-professional` job role itself is `isPublished = 0` in the DB — pre-existing, unrelated to this seed — so it won't necessarily surface via job-role browse UI, but that flag does not gate the unlock logic, which only checks `CertificationTrackJobRole.isPublished`):

| Certification | Requires subject tracks |
|---|---|
| Financial Literacy Fundamentals | `financial-statements-foundations` |
| Financial Literacy Practitioner | `financial-statements-foundations` + `applied-business-finance` |
| Financial Literacy Ready | all three |

## Unlock math to keep in mind while testing

- A topic is "done" at ≥70% correct coverage. With only 9 questions/topic, that rounds up to **needing 7/9 correct** (6/9 = 66.7% fails).
- A subject track is "done" at ≥70% of its topics done — with 2 topics per track, that means **both topics must be done**.
- A certification unlocks at ≥80% of its subject tracks done — with 1/2/3 tracks per tier, that means **all of them**, every tier.
- Quiz generation also gates by level within a topic: level 2 questions only appear once level 1 is cleared at ≥70% (2/3 correct), level 3 only once level 2 is cleared. With 3 questions/level, **missing more than one per level will block that level's harder questions from appearing** — answer everything correctly to move fastest.

Net effect: for the fastest possible full unlock, aim to answer every question correctly.

## Full answer key (correct option in **bold**)

### Topic 1 — Reading the Big Three Financial Statements

**L1** What report "shows what the company owns and owes at a single point in time"? → **The balance sheet**
**L1** What does the P&L primarily show? → **Revenue, expenses, and profit earned over a period of time**
**L1** Which statement tracks cash moving in and out over a period? → **The cash flow statement**
**L2** Profitable on P&L but struggling to pay suppliers — which statement explains why? → **The cash flow statement**
**L2** Assets $500k, liabilities $350k — equity? → **$150,000**
**L2** Liabilities growing faster than assets alongside strong P&L growth — what to check? → **Whether growth is funded by debt the business may struggle to service**
**L3** Negative operating cash flow for two quarters despite reported profit — likely cause? → **Profit includes non-cash revenue (e.g. unpaid invoices) not yet converted to cash**
**L3** "Profitable but insolvent" signal? → **Positive net income, but current liabilities exceed current assets**
**L3** Best cross-statement check on whether reported profit growth is "real"? → **Compare profit growth to operating cash flow growth over the same periods**

### Topic 2 — Core Financial Vocabulary

**L1** What is "revenue"? → **Total amount earned from sales, before costs are subtracted**
**L1** What a company owns (cash, equipment, inventory)? → **Assets**
**L1** What a company owes to others? → **Liabilities**
**L2** Margin shrank even though revenue rose — why? → **Costs grew faster than revenue**
**L2** What does "equity" represent? → **The owners' residual stake — assets minus liabilities**
**L2** Same revenue, Company A has much higher gross margin — what does that tell you? → **Company A keeps a larger share of each sales dollar after direct production costs**
**L3** "High EBITDA, low overhead" — what does EBITDA leave out? → **Interest, taxes, depreciation, and amortization — real costs like debt payments and aging equipment**
**L3** Equity grew mostly from issuing new shares, not retained profit — why does that matter? → **It signals the growth came from external funding, not from the business retaining its own profit**
**L3** Comparing asset-light vs. asset-heavy companies by balance sheet alone — key risk? → **Totals reflect different financing choices, not necessarily different operating performance**

### Topic 3 — Profitability & Cost Analysis

**L1** Which is a fixed cost? → **Monthly office rent**
**L1** What does "gross margin" measure? → **% of revenue left after direct production costs**
**L1** What is a "break-even point"? → **Sales level where total revenue equals total costs**
**L2** $50 price, $30 variable cost, $40,000 fixed costs/month — break-even units? → **2,000 units**
**L2** Operating margin dropped, gross margin flat — likely cause? → **Operating expenses (overhead, salaries, marketing) grew faster than revenue**
**L2** Risk of cutting sales commissions as a simple cost cut? → **Commissions are tied to revenue, so cutting them could reduce the sales activity that drives it**
**L3** Price +10%, volume −8% — effect on total revenue? → **Increases, because the price increase outweighs the volume decline**
**L3** High-fixed/low-variable Product A vs. low-fixed/high-variable Product B, both lose 30% volume in a recession — bigger profit hit? → **Product A, because its fixed costs don't shrink with lower volume**
**L3** $5,000 fixed-cost cut vs. $2/unit variable cut on 4,000 units/month — bigger saving, and the catch? → **Option B saves more, but the saving shrinks if volume falls below 4,000 units**

### Topic 4 — Budgeting, Forecasting & Variance

**L1** What is a "budget variance"? → **The difference between what was budgeted and what actually happened**
**L1** Budgeted $100k, spent $115k on marketing — favorable or unfavorable? → **Unfavorable, because it spent more than planned**
**L1** Budget vs. forecast — main difference? → **A budget is a fixed plan set in advance; a forecast is an updated estimate over time**
**L2** Revenue below budget but volume beat plan — shortfall from lower price — what does this tell you? → **A pricing issue, not a demand problem**
**L2** Cost center consistently well under budget every quarter — what to consider beyond praise? → **Whether the original budget was set too high, distorting planning elsewhere**
**L2** Mid-year forecast shows revenue 12% below budget — best next step? → **Identify which specific assumptions changed to drive the revised forecast**
**L3** Net favorable variance hiding contractor overspend offset by travel underspend — risk of reporting only the net? → **It hides a rising cost trend offset by a possibly one-off saving elsewhere**
**L3** Rolling forecast vs. fixed annual budget — main trade-off? → **Stays more accurate, but makes variance comparisons harder as the baseline moves**
**L3** Favorable variance driven by deals pulled forward from next quarter — how to assess it? → **Discount it — it may reflect revenue pulled forward, borrowing from next quarter**

### Topic 5 — Investment Appraisal Essentials

**L1** What does ROI measure? → **How much profit/gain an investment generates relative to its cost**
**L1** What does "payback period" tell you? → **How long until the investment's returns equal its original cost**
**L1** Which method ignores the time value of money? → **Payback period**
**L2** Why do NPV/IRR account for time value of money, unlike payback period? → **They discount future cash flows, treating sooner money as worth more than later money**
**L2** 2-year vs. 4-year payback — does shorter always mean better? → **Not necessarily — payback ignores what happens after that point and total value earned**
**L2** Positive NPV at your required rate of return — what does that mean? → **Expected to create more value than it costs, after accounting for time value of money**
**L3** 18% IRR/small investment vs. 15% IRR/large investment — why might the company still choose the larger one? → **It might generate far more total value even at a lower rate of return, given enough capital**
**L3** Cash flows mostly in years 4-5 vs. mostly years 1-2, same discount rate — higher NPV? → **The project with earlier cash flows, since later cash flows are discounted more heavily**
**L3** Required rate of return rises due to higher borrowing costs — effect on NPV? → **NPV falls, because future cash flows are discounted more heavily**

### Topic 6 — Business Case & Financial Risk Analysis

**L1** What is a "sensitivity analysis"? → **Testing how the outcome changes if key assumptions turn out differently**
**L1** What is an "assumption" in a business case? → **A projected input the conclusion depends on, not yet a proven fact**
**L1** Why identify the single most sensitive assumption? → **A small error in it would swing the outcome the most**
**L2** Business case relies on an unproven 25% year-one adoption rate — what to flag? → **The adoption-rate assumption is unproven and should be tested with more conservative scenarios**
**L2** Case A depends on one big assumption, Case B holds up across a range — which is lower risk? → **Case B, because its outcome is less sensitive to any single assumption being wrong**
**L2** Business case shows only the "expected" scenario, no range — main risk? → **It hides the range of possible outcomes and understates downside risk**
**L3** NPV turns negative if cost savings are 10% lower than assumed, but stays positive across revenue assumptions — what should this shape? → **Focus scrutiny on the cost-savings assumption, since the outcome is most fragile against it**
**L3** Assumption that a competitor won't respond now looks unlikely to hold — right response? → **Rerun the business case with an updated assumption and check whether the return still holds**
**L3** Comparing a lower-expected-cost/high-variance option to a higher-expected-cost/predictable option — how should risk thinking shape the choice? → **Weigh how much uncertainty the organization can tolerate, not just the expected cost**

## Verification already run

- `npm run seed` run twice: first created exactly 1 subject, 6 topics, 3 subject tracks, 6 track-topic links, 3 cert tracks, 3 cert-track-job-role links, 6 cert-track-subject-track links, 54 questions, 216 options; second run created 0 of everything (idempotent).
- DB spot-check: every question has exactly 4 options with exactly 1 marked correct, and every question has at least one topic link.
