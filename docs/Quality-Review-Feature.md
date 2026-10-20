# Quality Review Feature — Technical Reference

## 1. Overview

The Quality Review feature lets an SME (subject-matter expert) holding the `LmsManager`
permission audit the content quality of authored questions: approve a good question, reject
a broken/weak one with named issue tags, and optionally attach a 1–10 usefulness rating and a
free-text comment. Every review pass is stored as an immutable row — a full audit trail, never
a single mutable "current rating" field.

The feature has three moving parts:

1. **`quality_metric`** — a seeded catalog of reusable, named tags an SME can attach to a
   review (e.g. "Wrong question or answer", "Clear and Concise"). Split by polarity
   (Positive/Negative) and, for Negative tags, by severity (Minor/Medium/Severe).
2. **`quality_review`** — one row per review pass. Polymorphic (`resourceType` + `resourceId`)
   so the same table can one day cover Lesson reviews, though only Question is wired up today.
3. **`quality_review_tag`** — the M:N junction recording which metrics were attached to which
   review pass.

Reviewing a question also rolls a small summary up onto `Question` itself
(`reviewCount`, `lastReviewedAt`, `latestGrade`, `lastReviewOutcome`) and nudges its moderation
`status` — see §5.

## 2. Data model

```
quality_metric
  id                        PK
  code                      varchar(64) unique   -- 'wrong_question_or_answer', 'clear_and_concise', ...
  label                     varchar(150)         -- display text
  description               text NULL
  severity                  enum(Minor,Medium,Severe) NULL   -- NULL for Positive-polarity rows
  polarity                  enum(Positive,Negative) default Negative
  applicableResourceTypes   simple-json           -- e.g. ["Question"] — TEXT column, LIKE-matched
  questionTypeScope         enum(Trivia,General) NULL  -- NULL = applies to both
  isActive                  boolean default true
  orderIndex                int default 0
  createdBy / updatedBy     int NULL, FK -> user (SET NULL)

quality_review
  id            PK
  resourceType  enum(Question, Lesson) NOT NULL   -- QualityResourceTypeEnum; only Question is live
  resourceId    int NOT NULL                       -- no DB FK (polymorphic) — see §2.1
  reviewerId    int NOT NULL, FK -> user (RESTRICT)
  grade         int NULL                           -- 1-10, required by app logic on Approve
  outcome       enum(Approved, NeedsRevision, Rejected) NOT NULL
  comment       text NULL
  createdAt     datetime(6), default now()          -- doubles as submission time; rows are never updated
  INDEX (resourceType, resourceId)
  INDEX (reviewerId)

quality_review_tag
  id                PK
  qualityReviewId   int NOT NULL, FK -> quality_review (CASCADE)
  qualityMetricId   int NOT NULL, FK -> quality_metric (RESTRICT)
  comment           text NULL          -- per-tag note, e.g. "option B basically gives it away"
  createdAt         datetime(6)
  UNIQUE (qualityReviewId, qualityMetricId)
```

Entities: `src/common/typeorm/entities/quality-metric.entity.ts`,
`quality-review.entity.ts`, `quality-review-tag.entity.ts`.

### 2.1 Why `resourceType`/`resourceId` instead of a nullable FK per resource

`quality_review` follows the same polymorphic-association shape already used by
`UserPermission.resourceType`/`resourceId` elsewhere in this codebase, rather than a
dual-nullable-FK pair (`questionId` / `lessonId`, one always null). Trade-off: no real FK on
`resourceId`, so it can't point at two different tables at the DB level — referential integrity
for `resourceId` is enforced in the service layer, same as `UserPermission` already accepts.
`quality_metric.applicableResourceTypes` already speaks the same `QualityResourceTypeEnum`
vocabulary, so reusing it on `quality_review` costs nothing.

This schema replaced an earlier `questionId`/`lessonId` design — migration
`1788442559137-RedesignQualityReview.ts` backfills `resourceType='Question', resourceId=questionId`
for every surviving row and drops the old columns.

### 2.2 Why there's no `status` (Draft/Submitted)

An earlier iteration had a `status: Draft | Submitted` column supporting a resumable
in-progress review. It was removed: every current UI path (the Approve/Reject decision toggle
in the review dialog) already submits a final decision in one action, so a row is either
persisted as a finished review or it doesn't exist. This also makes the schema more internally
consistent with its own audit-trail intent — a resumable Draft was the one thing that didn't
fit "every row is a permanent, immutable pass." Practical effect: submitting a review is a
`POST` (always insert), not a `PUT` (find-existing-draft-or-insert).

### 2.3 Why `suggestedGradeCap` isn't a column

The "your grade of 8 conflicts with the Severe tag you attached, which suggests ≤3" signal is
real and worth keeping, but it's write-only: nothing ever reads a persisted value back after
the submit response (not shown in review history, not queried anywhere else). It's computed
transiently at submit time from whichever tags were just attached and returned once in the
response — see §4 `GRADE_CAP_BY_SEVERITY`.

### 2.4 Why `quality_review_tag` is a real table, not a JSON column

It's the M:N junction between one review and N attached tags — a Reject can carry
"Question malformed" *and* "Answer needs improvement" together — using the same idiom as
`QuestionTopic`/`JobRoleSubject` elsewhere in this codebase. Collapsing it into a JSON array on
`quality_review` would lose the per-tag `comment` field, lose the `RESTRICT` FK to
`quality_metric` (can't delete a tag that's in use), and break the `getTopIssueTags`/`tagCode`
filter joins that query through it (§6, §8).

### 2.5 `QualityReviewOutcomeEnum` keeps 3 values

`Approved` / `NeedsRevision` / `Rejected` — `NeedsRevision` is currently unreachable from the
UI (the dialog only offers Approve/Reject) but real historical rows use it, and
`getFlaggedForRevision`'s `NeedsRevision OR Rejected` check treats them the same. Trimming the
enum would require migrating existing data for no functional gain.

## 3. Quality metric catalog

Seeded via `src/database/seeds/seeders/07-quality-metrics.seeder.ts` (idempotent — skips any
`code` that already exists). 25 rows as of this writing:

| Polarity | Severity | Codes |
|---|---|---|
| Negative | Severe | `wrong_question_or_answer`, `question_malformed`, `not_relevant`, `completely_irrelevant`, `duplicate_question`, `inappropriate_content` |
| Negative | Medium | `guessable_wrong_options`*, `answer_too_predictable`*, `question_too_complex`, `answer_needs_improvement`, `outdated_information`, `ambiguous_wording`, `multiple_correct_not_marked`* |
| Negative | Minor | `minor_wording_grammar`, `formatting_inconsistency`, `could_use_better_hint`, `inconsistent_terminology` |
| Positive | — | `just_acceptable`, `good_to_know`, `well_explained`, `conceptual_and_highly_useful`, `real_world_relevant`, `well_structured_options`*, `clear_and_concise`, `great_for_beginners` |

`*` = scoped to `questionTypeScope: Trivia` only; every other row applies to both Trivia and
General questions (`questionTypeScope: NULL`).

`listQualityMetrics(questionType?, resourceType = Question)` (`question-quality.service.ts`)
returns active rows filtered by `applicableResourceTypes LIKE '%"Question"%'` and, if a
`questionType` is given, rows where `questionTypeScope IS NULL OR questionTypeScope = :qt`.

There is no create/edit UI for the catalog yet — it's admin/seed-managed. Adding a tag means
adding an entry to the seeder array and re-running `npm run seed` (safe — idempotent by code).

## 4. Submitting a review (`QuestionQualityService.submitReview`)

`src/modules/lms/providers/question-quality.service.ts`

```ts
submitReview(resourceType, resourceId, reviewerId, input: SubmitQualityReviewInput)
  // input: { outcome, grade?, comment?, tagIds? }
```

Runs in one transaction:

1. **Always inserts** a new `QualityReview` row — no draft lookup, no update path.
2. Inserts one `QualityReviewTag` row per `tagIds` entry (only for metrics that actually exist
   — `metricRepo.findBy({ id: In(tagIds) })`, silently drops unknown ids).
3. Computes the worst attached severity (`Severe > Medium > Minor`, via `SEVERITY_RANK`) and an
   advisory `suggestedGradeCap` from it (`Severe → 3, Medium → 6, Minor → 9`,
   `GRADE_CAP_BY_SEVERITY`) — never persisted, never enforced/clamped.
4. `mismatch = grade != null && suggestedGradeCap != null && grade > suggestedGradeCap`.
5. **Only when `resourceType === Question`** (Lesson has no rollup columns yet — same gate
   `listQualityMetrics` uses), atomically updates the `Question` row:
   - `reviewCount + 1`, `lastReviewedAt`, `latestGrade`, `lastReviewOutcome` — always.
   - **Moderation-status nudge**, via a `CASE` on the row's *current* status (avoids a
     read-then-write race):
     - `outcome = Approved` → `Pending → Active` (anything else unchanged)
     - `outcome = Rejected` → `Active → Pending` (anything else unchanged)
     - `outcome = NeedsRevision` → no status change

Returns `{ review, suggestedGradeCap, mismatch }`.

## 5. Question-status interaction

This is the only place quality review touches question moderation. It's a one-way nudge, not a
full state machine:

| Question status before | Outcome | Question status after |
|---|---|---|
| Pending | Approved | **Active** |
| Active | Approved | Active (no-op) |
| Active | Rejected | **Pending** |
| Pending | Rejected | Pending (no-op) |
| Inactive | anything | Inactive (no-op — never touched) |
| any | NeedsRevision | unchanged |

An `Inactive` question is never moved by a review outcome — it must be reactivated separately
(outside this feature) before Approve/Reject can affect its status again.

## 6. Reading review data

- **`getReviewHistory(resourceType, resourceId)`** — every review ever submitted for one
  resource, newest first, with `reviewer` and `tags.qualityMetric` eagerly joined. Powers the
  review-dialog's "Review history" panel.
- **`getFlaggedForRevision(subjectId?, limit=20)`** — "latest review per question" pattern:
  a subquery groups `quality_review` by `resourceId` and takes `MAX(id)`, then re-joins to get
  only the most recent pass per question, filtered to `outcome IN (NeedsRevision, Rejected)`.
  Same MAX(id)-per-group technique `SubjectStatsService` uses for "latest attempt per question."
- **`getTopIssueTags(subjectId?, limit=10)`** — counts `quality_review_tag` rows joined to
  `quality_metric`, filtered to `resourceType = Question AND polarity = Negative`. The polarity
  filter matters: without it, a Positive tag attached on an Approve (e.g. "Good to Know") would
  count here too, with a null severity, rendering as if it were a low-severity problem.
- **`getQualityPipelineSummary(subjectId?)`** — combines the above with existing
  moderation-count and attempt-derived widgets (never-attempted, too-hard/too-easy/confusing
  outliers, min sample 10) into the payload behind `GET apis/lms/dashboard/quality-pipeline`.

## 7. API endpoints

All routes require `AuthGuard('jwt')` + `RolesGuard` (`Roles(UserRoleEnum.USER)`), then an
explicit `ensureLmsAccess(req.user.id)` check inside the handler that throws `403` unless the
caller holds the `LmsManager` permission (checked by permission name or the hardcoded
`permissionId === 4` fallback). Controller: `src/modules/lms/lms.controller.ts`.

| Method | Path | Purpose |
|---|---|---|
| GET | `apis/lms/questions` | Review queue — cross-author, unlike the content-authoring list. `?status=unreviewed\|flagged\|all`, `?subjectSlug=`, `?questionType=`, `?limit=` (default 100). |
| GET | `apis/lms/questions/:id/review-detail` | Full question detail (options/hint/answer/topics) for the dialog's left panel. |
| GET | `apis/lms/quality-metrics` | The tag catalog, optionally `?questionType=`. |
| GET | `apis/lms/questions/:id/quality-reviews` | Review history for one question. |
| **POST** | `apis/lms/questions/:id/quality-reviews` | Submit a new review (§4). Body: `SubmitQualityReviewDto`. |
| GET | `apis/lms/dashboard/quality-pipeline` | Aggregate dashboard payload (§6), optional `?subjectId=`. |
| GET | `apis/lms/dashboard/subjects` | Per-subject rollups (review coverage, avg grade, moderation counts) — used by the dashboard's Subjects tab. |
| GET | `apis/lms/dashboard/trends` | Daily/weekly time series including an "SME reviews submitted" series (§9). |

**Note:** this endpoint was a `PUT` in the earlier Draft/Submitted design (upsert semantics).
It's now `POST` because every call is a genuine insert.

`SubmitQualityReviewDto` (`src/modules/lms/dtos/submit-quality-review.dto.ts`):

```ts
{
  outcome: QualityReviewOutcomeEnum;   // required
  grade?: number | null;               // 1-10, optional
  comment?: string | null;             // optional
  tagIds?: number[];                   // optional, quality_metric ids
}
```

The controller hardcodes `resourceType = Question` when calling the service — Lesson isn't
wired into any route yet, so only the service/schema are resource-agnostic; the controller
layer stays question-specific for now.

## 8. Cross-cutting consumers

Two other backend areas read through `quality_review`/`quality_review_tag` and had to be
updated in lockstep with the schema redesign — both use the "latest review per resource"
subquery pattern from §6:

- **`QuestionService`** (`src/modules/question/providers/question.service.ts`) — the
  `tagCode` filter on the question list/viewer joins the latest review per question and
  filters to reviews carrying a specific tag code (drives "show me every question tagged
  'Ambiguous wording'" from a dashboard drill-down).
- **`LmsDashboardService`** (`src/modules/lms/providers/lms-dashboard.service.ts`) —
  `reviewsQb()` feeds the Trends tab's "SME reviews submitted" daily/weekly series, keyed off
  `r.createdAt` (there is no separate `submittedAt` column any more — `createdAt` is the
  submission time, since rows are immutable).

If `quality_review`'s shape changes again, grep both files for `resourceType`/`resourceId`
before assuming the change is contained to `question-quality.service.ts`.

## 9. Frontend

Angular module: `src/app/lms/quality-review/`.

- **`quality-review.model.ts`** — TypeScript mirrors of the DTOs above
  (`QualityReviewEntry`, `SubmitQualityReviewPayload`, `SubmitQualityReviewResult`,
  `QualityMetricCatalogEntry`, `ReviewQueueRow`, `ReviewQuestionDetail`).
- **`quality-review.service.ts`** — thin HTTP wrapper; `submitReview()` calls
  `httpService.postData(...)` against the `POST` endpoint above.
- **`queue/quality-review-queue.component.ts`** — the review queue page, route
  `/lms/quality-review` (`Role.Admin` + `LmsManager` permission gate, see
  `quality-review.routes.ts`). Tabs: Unreviewed / Flagged / All, optional subject filter.
  Clicking a row opens `QualityReviewDialogComponent` in a fullscreen Material dialog
  (`panelClass: 'qr-fullscreen-dialog'`); on close, reloads the queue if a review was
  submitted.
- **`review-dialog/quality-review-dialog.component.ts`** — the review UI itself (§10 for the
  end-user walkthrough). Left panel: question detail + review history (read-only). Right
  panel: Approve/Reject toggle, conditional grade/tags/comment inputs, Submit button. There is
  no Save Draft button — Submit is the only action, and it's disabled until a decision is
  picked (and, for Approve, a grade).
- **Dashboard** (`src/app/lms/dashboard/`) — `quality-tab` renders the aggregate widgets
  from §6/§8 (KPI tiles, Grade Distribution, Top Issue Tags, Flagged for Revision, Moderation
  Status, Never Attempted, Attempt-Behavior Outliers); most tiles/rows link into the Question
  Viewer (`/lms/questions/viewer`) pre-filtered via query params (`qualityFilter`, `tagCode`,
  `neverAttempted`) rather than opening the review dialog directly.

## 10. Known gaps / open items

- **Lesson reviews are schema-ready but not wired up.** `QualityResourceTypeEnum.Lesson`
  exists and `quality_review`/`quality_review_tag` already support it, but no `quality_metric`
  rows are seeded with `Lesson` in `applicableResourceTypes`, and no controller route submits a
  Lesson-scoped review. Wiring this up means: seed Lesson-specific tags, add a
  `resourceType`-aware endpoint (or parameter) instead of hardcoding `Question` in the
  controller, and decide whether Lesson needs its own rollup columns (§4 step 5's gate).
- **No catalog management UI.** Adding/editing/retiring a `quality_metric` row requires editing
  the seeder and redeploying — there's no admin screen for it yet.
- **`NeedsRevision` is unreachable from the current UI.** The enum and downstream logic
  (`getFlaggedForRevision`) support it, but the review dialog only offers Approve/Reject. If a
  three-way decision is ever wanted, the dialog's decision toggle is the only frontend change
  needed — the backend already treats it correctly everywhere.
