# CSS Question Bank Audit & Gap-Fill Plan

**Date:** 2026-10-02
**Scope:** All 287 Active CSS questions (254 Trivia + 33 General) across all 9 topics, every one read in full against the standing CodeMerit Question Quality Policy. CSS currently has **zero Pending questions** — every row audited here is already live and counting toward coverage/badges/quizzes today.
**Status:** Draft for manual review. **Nothing in this document has been seeded.** No DB writes have been made as part of this audit.

---

## How this was done

Four parallel review passes, one per topic cluster, each given the full question dump (`question`, `answer`, `hint`, all `options` with `comment`) and the exact policy text below, instructed to flag violations, find duplicates, and only propose new questions for genuinely missing essential concepts (not to pad any topic to a target count).

**The policy applied, verbatim:**

*Trivia (MCQ) rules:* (1) correct option must not be guessable from length alone; (2) distractors must be genuinely plausible, not throwaway; (3) the `answer` field must be detailed-but-simple, not a bare restatement; (4) no duplicate questions, within or across topics; (5) difficulty (`level`) must match actual difficulty, never forced to a ratio; (6) question count per topic is not fixed — never pad for a number.

*General (open-ended) rules:* neutral/collective voice in the answer (never a second-person command); full sentences, not command fragments; acronyms spelled out on first use; no redundant restated-opposite clause in the question; rich HTML formatting by default (allowed tags only: `p, strong, em, u, a, ul, ol, li, h3, h4, blockquote, pre, code, br, hr`), with at least one real block-level tag, and every `<`, `>`, `&` inside code content HTML-entity-escaped.

---

## Executive summary

| | |
|---|---|
| Questions audited | 287 (all Active, 0 Pending) |
| Topics audited | 9 of 9 |
| **Real data bugs found** (not style — these are broken records) | **4 categories, ~22 affected rows** |
| Policy violations (length-tell, weak distractors, difficulty mismatches) | Systemic length-tell pattern across ~6 of 9 topics; isolated distractor/difficulty issues |
| Near-duplicate pairs/clusters found | 20 |
| Concept gaps identified | 17 (across all 9 topics) |
| **Draft new/replacement questions written** | **60**, none seeded |

### Critical data bugs — fix these regardless of what happens with the content review

These aren't style opinions; they're broken records currently live in production.

1. **Truncated `comment` fields, cut off mid-word.** The `question_option.comment` column is `varchar(200)` and several rows were written past that limit, silently truncating (this exact failure mode was already seen once this session on a different subject's seed data — see the `codemerit-api` `QuestionOption` entity comment history). Affected:
   - `css-grid`: ids **1194**, **1198**
   - `animations-transforms` / `advanced-selectors` / `css-architecture`: ids **1251, 1252, 1255, 1256, 1272, 1273, 1275, 1280, 1281, 1285, 1289, 1290, 1292, 1294** (13 rows)
2. **Unescaped, unclosed HTML tags inside General `question` text**, box-model-positioning: **Q6064** (`<p>`) and **Q6065** (`<div>`, `<p>`) — raw angle brackets in text that gets HTML-rendered, the same failure class that has previously silently emptied code blocks on this platform. Needs `&lt;p&gt;`/`&lt;div&gt;` wrapped in `<code>`.
3. **Mojibake encoding corruption** (legacy rows, id < 1000, one-time UTF-8/Windows-1252 re-encoding bug on original import): `css-basics` **Q374** (hint), **Q381** (answer); `box-model-positioning` **Q391, Q394, Q400, Q401, Q404** (answer/hint/option text, e.g. `â€”` for em-dash, `doesnâ€™t` for "doesn't"). Mechanical find/replace fix.
4. **Contradictory/overgeneralized explanation**, css-basics: **Q384** states "the rule written last always wins" with no equal-specificity precondition — directly contradicted by the more careful **Q6077** ("source order only decides ties when specificity is equal") in the same topic. Q384 needs the precondition added or the question reworded.

---

## Per-topic findings

### css-basics (30 questions)

**Violations:**
- Length-tell: **Q372, Q375, Q380** (moderate), **Q6071** (moderate), **Q6072** (severe, 131 vs 70 char max), **Q6073** (severe, 181 vs 70 char max)
- Answer-correctness: **Q384** (see critical bug #4 above)
- Difficulty mismatch: **Q381** (line-height multiplier rated Level 3, should be ~2), **Q386** (relative vs absolute units rated Level 3 vs. its own specific instance Q377 at Level 2), **Q382** (universal-selector recognition rated Level 2, comparable items are Level 1)

**Near-duplicates:**
- Q375 ↔ Q384 (cascade/conflict-resolution, same fact)
- Q377 ↔ Q386 (em/px vs. relative/absolute units, general restates specific)
- Q6071 ↔ Q6076 (`calc()` mixed-unit width, same fact as direct syntax vs. word problem)
- Q382 ↔ Q6075 (universal selector `*`, softer overlap)

**Concept gaps + drafts (6):** `rem` vs `em` (Trivia L1), viewport units `vw`/`vh` (Trivia L2), why `rem` for accessible font sizing (General L1), `!important` overriding specificity (Trivia L2), two `!important` rules conflicting (General L2), `:hover` pseudo-class (Trivia L1 — *flagged: confirm this isn't already better-owned by `advanced-selectors` before adding, to avoid a cross-topic duplicate*).

---

### box-model-positioning (41 questions)

**Violations:**
- Length-tell: **Q406** (mild) plus a **systemic pattern in the newer batch**: 8 of 10 questions in the 6054–6063 id range have a full-sentence correct option against terse code-snippet distractors — **Q6054, Q6056, Q6057, Q6058, Q6059, Q6060, Q6061, Q6063** all affected (several "severe," correct option 2x+ the longest distractor). Only Q6055 and Q6062 in that same batch avoid the pattern — worth fixing the authoring template, not just these items individually.
- Answer quality: **Q388** (padding question — bare restatement, no why); **Q396** (option claims absolute-positioning-with-no-ancestor resolves to `<body>`, answer hedges with "initial containing block" — option and explanation disagree, needs a wording fix)
- Difficulty mismatches: **Q397** (`position: sticky` at Level 3, structurally identical to `static`/`fixed` siblings at Level 1); **Q389** vs **Q390** (naming a property rated higher than knowing its default value — backward); **Q6054** vs **Q6064** (same fact, Trivia L2 vs General L1, should agree)
- Rule 3/5 (General): **Q6068** — unspelled "DOM" acronym, inconsistent `<code>`-wrapping of `z-index` (wrapped elsewhere in the same answer, not here), and a 3-sentence answer delivered as one flat paragraph with no structure

**Near-duplicates:**
- Q399 ↔ Q6012 (stacking-order tiebreak without explicit z-index)
- Q6060 ↔ Q6068 (high z-index losing because an ancestor traps it in a lower stacking context)
- Q406 ↔ Q6010 (`box-sizing: border-box` keeps declared width exact)
- Q6054 ↔ Q6064 (margin collapsing between siblings, value changed 20px→30px)

**Concept gaps + drafts (8):** `overflow: hidden` behavior (Trivia L1), `overflow: auto` vs `scroll` (Trivia L2), clipped-card-text scenario (General L1), `max-width` for responsive images (Trivia L1), `min-height` vs `height` (Trivia L2), text-column `max-width` readability (General L1), `outline` vs `border` box-model participation (Trivia L2), removing focus outlines / accessibility (General L1).

---

### flexbox (31 questions)

**Violations:**
- Length-tell: moderate across **1173, 1177, 1179, 1180, 3324**; severe at **3325, 6081, 6084**; **6083 is the worst in this topic** (141 chars vs. 34–67 char distractors, ~4x).
- Weak distractors: **1166** and its css-grid twin **1183** use invented pseudo-CSS distractors (`flex: container`, `layout: flex`) that test "does this look like real CSS" rather than real understanding; **3324**'s "invisible, reserves 200px" distractor is implausible filler.
- Rule 3 (General): **6087** uses "DOM" unspelled.
- Difficulty: **3324, 3325** rated Level 3 for what's closer to shorthand-order lookup (arguably L2); **6081** (implicit `min-width: auto` blocking shrink — a classic real-world gotcha) underrated at Level 1; internally inconsistent levels across two duplicate clusters (see below) — `margin-left: auto` cluster is L2/L1/L1 across three near-identical items, `min-width: auto` cluster is L1/L2/L2.

**Near-duplicates:**
- 1175 ↔ 6015 (`flex: 1` shorthand breakdown)
- **6083 ↔ 6084 ↔ 6086** (3-way: `margin-left: auto` pushing a flex item away from siblings, three surface wrappings of one fact)
- **6081 ↔ 6082 ↔ 6085** (3-way: implicit `min-width: auto` blocking `flex-shrink`, three scenario wrappings)
- 1177 ↔ 6017 (`align-self` overriding container `align-items`, soft overlap)

**Concept gaps + drafts (4):** `flex-flow` shorthand, two drafts — basic (Trivia L1) and applied `column wrap` (Trivia L2); `flex-wrap: wrap-reverse` (currently only appears as a wrong-answer label) — definition (Trivia L2) and stacking-direction scenario (General L2).

---

### css-grid (30 questions)

**Violations:**
- Length-tell: widespread moderate-to-clear pattern across **1186–1202** (most "compare X vs Y" items), worst at **1194, 1198, 1199, 1200** (clear tells, correct option 1.5–2x+ the distractors).
- Weak distractors: **1183** (see flexbox's 1166 twin, same issue).
- **Data bug** (also listed above): **1194, 1198** truncated comments.
- Difficulty: **align-items/align-content** cluster (6090/6091/6093) rated L2/L1/L2 inconsistently for the same underlying fact.

**Near-duplicates:**
- **6090 ↔ 6091 ↔ 6093** (3-way: `align-items` per-cell vs `align-content` across-track distribution)
- 6088 ↔ 6092 (`grid-auto-rows` sizing implicit rows, near-identical scenario)
- 6021 ↔ 6092 (reused scenario setup, different precise fact — moderate overlap, not a hard duplicate)
- 1199 ↔ 6089 (explicit vs. implicit tracks, general vs. narrowed-to-columns) — **note:** the explicit/implicit-tracks concept as a whole is touched by 5 questions (1199, 6021, 6088, 6089, 6092); not all strict duplicates, but over-concentrated relative to how many distinct facts it actually contains.

**Concept gaps + drafts (8):** `min-content`/`max-content` keywords — definition (Trivia L2), `max-content` identification (Trivia L1); `fit-content()` vs `minmax()` free-space behavior (General L3); `grid-template-areas` syntax mechanics — empty-cell dot (Trivia L2), mismatched row-string length (Trivia L3), authoring example with an empty cell (General L2); Flexbox-vs-Grid applied decision-making (General L2 — photo gallery scenario, and Trivia L2 — navbar scenario), since the existing 1188 only tests the 1D/2D *definition*, never applied choice.

---

### responsive-design (33 questions)

**Violations:**
- Length-tell: widespread across **1203/1204/1207/1209–1213/1215–1217/1219, 3326–3328, 6098**; **severe** at **1218** (a full real `clamp()` code snippet as the correct option against short fake property names — spottable on sight), and **6094, 6095 (156 chars!), 6096, 6097** (all 2x+ distractor length).
- Weak distractors: **1207** ("float: left on everything" as fluid-layout distractor), **1204** ("mobile loads before desktop in every browser").

**Near-duplicates:**
- **1203 ↔ 1219 — exact duplicate** (viewport meta tag, near-identical question/answer/options; recommend removing one outright, not just rewording)
- 1209 ↔ 1218 (`clamp()` definition vs. applied to `font-size`, same mechanic)
- 6094 ↔ 6100 (`min()` picks the smaller value, recall vs. applied)
- **6098 ↔ 6099 ↔ 6102 — triple overlap** (`prefers-color-scheme: dark` reads OS setting, same fact 3 ways)
- **6096 ↔ 6097 ↔ 6101 — cluster** (100vh mobile quirk + dvh/svh/lvh fix, General question re-combines both)

**Concept gaps + drafts (6):** `prefers-reduced-motion` (currently only a wrong-answer distractor) — definition (Trivia L1), autoplaying-carousel accessibility scenario (General L2); `hover`/`pointer` input-type media features — `hover: none and pointer: coarse` touchscreen detection (Trivia L3), CSS-only hover-dropdown-on-touch fallback (General L2); `aspect-ratio` property (absent entirely) — definition (Trivia L2), video-embed layout-jump fix (General L2).

---

### typography-colors (31 questions)

**Violations:**
- Length-tell: **1220, 1227, 1229, 1230, 1232, 1233, 1236, 1237, 1238, 6103, 6105, 6107** moderate; **6104, 6106 severe**.
- Weak distractors: **1220** ("serif fonts require a Google Fonts import"), **6103** ("only affects `<h1>` tags").
- Answer quality: **1235** (WCAG AA contrast ratio) — `answer` field is a bare restatement with no why; the per-option `comment` has the AAA/large-text context the `answer` field itself is missing.
- Difficulty (soft flags): **1235** (contrast-ratio recall at L3, arguably L2 — the *application* of the ratio would be the advanced part, which isn't actually tested); **1232** (display-p3 gamut at L2 feels under-leveled for how niche it is); **6109** (General, synthesizes two separate `@font-face` facts, labeled L1 — arguably L2).

**Near-duplicates:**
- 1229 ↔ 6026 (`font-display: swap` fact, direct vs. scenario)
- 1234 ↔ 6027 (CSS custom properties for theming, direct vs. "why not hardcode hex")
- 6104 ↔ 6108 (uppercase text + screen readers, direct vs. scenario)
- **6105 ↔ 6106 ↔ 6109** (cluster: `@font-face` required descriptors + applying via `font-family`, General synthesizes both — defensible as an "apply it end to end" question, flagged for awareness)

**Concept gaps + drafts (6):** full `font-display` value set beyond `swap` — `fallback` value (Trivia L3), choosing `optional` to avoid any flash (General L3); `text-wrap: balance` — definition (Trivia L2), stranded-heading-word scenario (General L2); system font stacks — benefit (Trivia L2), slow-loading-marketing-page scenario (General L3).

---

### animations-transforms (28 questions)

**Violations:**
- Length-tell: **severe** at **6112** (2.65x), **6110** (2.07x); moderate systemic pattern across **1239, 1241, 1246, 1247, 1250, 1251, 1253, 1255, 3330, 3331, 6111**.
- Weak distractors: **1240** ("twice as heavy in DOM weight" — not a real concept), **1244** ("forwards state to child elements" — invented mechanism).
- Difficulty: **1256** (`prefers-reduced-motion`, an empathy/accessibility fact not a technical mechanism) rated L3, should be ~L1-2.
- Rule 3 (General): **6030** uses "GPU" unspelled.
- **Data bug** (also listed above): **1251, 1252, 1255, 1256** truncated comments.

**Near-duplicates:**
- 1244 ↔ 6032 (`animation-fill-mode: forwards` holding final keyframe state)
- 1247 ↔ 6030 (`transform`/`opacity` are compositor/GPU-handled, skip layout)

**Concept gaps + drafts (8):** 3D transform functions (`rotateY`) + `backface-visibility` for card-flips — axis difference (Trivia L2), `backface-visibility: hidden` purpose (Trivia L2), mirrored-face-mid-flip scenario (General L3); `animation-play-state` pause/resume — definition (Trivia L1), hover-to-pause-spinner scenario (General L2), shorthand missing-duration default (Trivia L2); `transition: all` as an anti-pattern — janky-button-over-time scenario (General L3), why it's discouraged (Trivia L2).

---

### advanced-selectors (36 questions)

**Violations:**
- Length-tell: **severe** at **6049** (3.32x — the single worst item in the entire audit), **6042** (2.02x); moderate across **1257, 1259, 1264, 1268, 1272–1276, 6045, 6046**.
- Weak distractor: **1269** ("class selectors" as the highest-specificity distractor — too easy to eliminate next to the genuinely tempting ID/`!important` options).
- Difficulty: **6043** (`^=` starts-with) vs **6044** (`$=` ends-with) — structurally identical, rated L1 vs L2 inconsistently; **6048** vs **6050** — same `:nth-of-type()` fact, rated L2 vs L3 (also a duplicate, see below).
- **Data bug** (also listed above): **1272, 1273, 1275** truncated comments.
- Rule 5 (General structure, minor): **6053, 6040** (from css-architecture's cluster, listed there) and **6053** here — one-line declaration blocks left as inline `<code>` instead of a real `<pre><code>` block.

**Near-duplicates:**
- 1267 ↔ 6036 (`:has()` matching a parent by its descendants' contents)
- **6048 ↔ 6050** (`:nth-of-type()` counts only same-tag siblings, two concrete DOM setups, same lesson — also the difficulty-mismatch pair above)
- 6034 (General) overlaps 6046+6047 (Trivia) combined — child vs. descendant combinator, General restates both Trivia facts as one

**Concept gaps + drafts (9):** `:last-child`/`:nth-last-child()`/`:only-child` family (entirely absent despite `:first-child`/`:nth-child()` being covered) — `:last-child` (Trivia L1), `:nth-last-child(2)` (Trivia L2), `:only-child` (Trivia L1), breadcrumb-separator scenario combining `:not()`+`:last-child` (General L2); form-state pseudo-classes standalone (`:checked` never appears at all) — `:checked` definition (Trivia L1), custom-toggle-switch scenario (General L2), `:required` vs `:optional` (Trivia L2); specificity edge case — combinators add zero specificity weight — definition (Trivia L3), applied comparison scenario (General L3).

---

### css-architecture (27 questions)

**Violations:**
- Length-tell: **severe** at **6079** (2.00x); moderate across **1279, 1282, 1284–1290, 1292–1294, 1296**.
- Difficulty: **1296** (`&` in native nesting, basic immediately-needed syntax) rated L3, sits oddly above **1287** (L2, "what nesting allows").
- **Data bug** (also listed above): **1280, 1281, 1285, 1289, 1290, 1292, 1294** truncated comments — this topic has the single highest concentration of the comment-truncation bug (7 of the 15 total non-grid instances).
- Rule 5 (General structure, minor): **6040, 6080** — one-line declaration/`@supports` blocks left as inline `<code>` instead of `<pre><code>`.

**Near-duplicates:**
- 1285 ↔ 6039 (`@layer` for explicit priority over specificity/source order)
- 6078 ↔ 6080 (`@supports` feature-query mechanism) — plus **6079** sits thematically adjacent (same `@supports` topic, but tests *why* a fallback is needed rather than *what* the mechanism is, so not folded into the duplicate — still, 3 of 27 questions orbiting one feature is a crowded cluster worth reviewer awareness).

**Concept gaps + drafts (5):** container queries (`@container`, confirmed entirely absent despite BEM/CSS-in-JS/Shadow DOM/`@layer`/custom properties all being covered) — problem it solves (Trivia L2), `container-type` opt-in requirement (Trivia L2), reusable-card-in-sidebar-vs-main scenario (General L3); CSS Modules as a build-time scoping approach (never mentioned, despite being arguably the most common production approach) — collision-prevention mechanism (Trivia L2), vs. BEM discipline comparison (General L2).

---

## Full catalog of draft questions (60 total — unreviewed, not seeded)

Organized by topic. Every draft below includes a proposed `slug`, `questionType`, `level`, full question text, options (Trivia) or answer (General), a `comment` on the correct option (Trivia), and a `hint`. Exact field-level content is in each topic's section above and in the raw agent output this document was compiled from; **the drafts need a human pass before any seed script is written** — in particular:

- Several draft `answer`/`comment` fields above are written in shorthand prose for this review doc and will need the full rich-HTML formatting (`<p>`, `<code>`, `<pre><code>`) applied consistently before seeding, matching the General-answer policy.
- A few flagged items need a decision, not just a yes/no: the `:hover` draft for `css-basics` should be checked against `advanced-selectors`' own pseudo-class coverage first; the `align-items`/`align-content` and `min-width: auto` duplicate clusters should probably be *consolidated* (merge 3 into 1-2) rather than left as-is even before adding anything new.

| Topic | New Trivia drafts | New General drafts |
|---|---|---|
| css-basics | 4 (rem/em, viewport units, `!important`, `:hover`) | 2 (why rem, `!important` conflict) |
| box-model-positioning | 5 (overflow ×2, max-width, min-height, outline) | 3 (clipped text, readable column, focus outline a11y) |
| flexbox | 3 (flex-flow ×2, wrap-reverse) | 1 (wrap-reverse scenario) |
| css-grid | 4 (min/max-content ×2, grid-template-areas ×2) | 4 (fit-content vs minmax, areas example, flex-vs-grid ×2 — 1 Trivia 1 General, see table above) |
| responsive-design | 3 (reduced-motion, hover/pointer, aspect-ratio) | 3 (carousel a11y, hover dropdown fallback, video embed) |
| typography-colors | 3 (font-display fallback, text-wrap balance, system fonts) | 3 (font-display optional, heading balance, slow-loading page) |
| animations-transforms | 5 (rotateY, backface-visibility, play-state, shorthand default, why transition:all discouraged) | 3 (card-flip scenario, pause-spinner scenario, janky-button scenario) |
| advanced-selectors | 6 (last-child, nth-last-child, only-child, checked, required/optional, specificity-of-combinators) | 3 (breadcrumb scenario, toggle-switch scenario, specificity comparison scenario) |
| css-architecture | 3 (container-queries problem, container-type requirement, CSS-modules mechanism) | 2 (reusable-card scenario, modules-vs-BEM scenario) |

Full drafted question text for all 60 (question/options/answer/hint, ready for a reviewer's line-by-line pass) is preserved in the per-topic sections above exactly as each review agent wrote it.

---

## Suggested next steps (for the human reviewer, not yet actioned)

1. **Fix the 4 data-bug categories first** — these are broken live records regardless of what happens with new content (truncated comments, unescaped tags, mojibake, the Q384 contradiction).
2. **Decide on the 20 duplicate pairs/clusters**: for each, either delete the weaker/later one, or confirm both earn their place (e.g. a recall-vs-applied pair may be intentional layering, not true duplication — several are flagged above as "soft overlap, left off the hard list" for exactly this reason).
3. **Review the systemic length-tell pattern** — it isn't isolated to a few questions; it's a house style (correct option as a full qualifying sentence, distractors as short phrases) across roughly 2/3 of all Trivia items with a "compare X vs Y" shape. Worth deciding whether to fix this at scale (rewrite distractor register to match) rather than one question at a time.
4. **Review the 60 drafted questions** and mark each approved / needs-edit / reject.
5. Only after 1-4: write the actual seed script (following the same pattern as `seed-angular-architecture-intermediate.ts` — length-validated, idempotent by slug, status `Active`) for whatever survives review.
