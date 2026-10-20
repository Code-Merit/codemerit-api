# Frontend Guide: Admin Dashboard

Integration guide for `GET /apis/admin/dashboard` — the single endpoint powering the admin overview
screen. The response is pre-grouped by domain so each section renders as an independent widget
without client-side aggregation. Every example below was captured from one live call against the
running API with real data, not hand-typed.

## 0. Current shape

```
GET /apis/admin/dashboard →
{
  overview, people, content, engagement, achievements, interviews,
  enrollments, revenue, recentActivity, trends, meta
}
```

`enrollments` and `revenue` are the newest sections — the platform grew a full tiered-subscription
model (`Basic → Curious → Pro → Intern → Serious`) with real payments (Razorpay for INR, Stripe for
USD) since this dashboard last shipped, and it previously had zero visibility into plan
distribution, conversion, or revenue. `interviews` was added slightly earlier, same pattern. If
you're integrating this for the first time, there is no older flat shape to migrate from — treat
everything below as current.

## 1. Auth & response envelope

Requires `Authorization: Bearer <jwt>` for a user with the `Admin` role. Every response is wrapped
identically:

```jsonc
// success (any 2xx)
{ "error": false, "result_code": 200, "message": "Data fetched successfully.", "data": { /* §2 shape */ } }
// error (any 4xx/5xx) — e.g. non-admin caller
{ "error": true, "statusCode": 403, "message": "Forbidden resource, ...", "data": null }
```

Branch on `response.error`. This HTTP-level envelope only covers things that block the *whole*
request (auth failure) — a failure in one dashboard section never surfaces here; see §11 (`meta`).

## 2. `overview` — KPI strip

Every field is duplicated from a deeper section — a top-of-page KPI strip that doesn't need to
reach into 6 different sub-objects. Use the deeper section for anything beyond the raw number.

```ts
interface OverviewStats {
  totalUsers: number; activeUsers: number; newUsersToday: number;
  totalPrograms: number; totalCertificationTracks: number; totalSubjectTracks: number;
  totalSubjects: number; totalTopics: number; totalQuestions: number;
  totalQuizzes: number; totalLessons: number;
  totalQuizAttempts: number; totalQuestionAttempts: number;
  certificatesIssued: number; badgesAwarded: number; totalInterviews: number;
  totalActiveEnrollments: number; payingUsers: number;
}
```

**No blended revenue number here** — INR (Razorpay) and USD (Stripe) are separate ledgers; a summed
figure would silently mix two currencies into a meaningless total. Revenue only ever appears inside
`revenue`, where currency is always explicit. `totalActiveEnrollments`/`payingUsers` are safe as
single numbers since they're plain counts, not money.

Real captured example:
```json
{
  "totalUsers": 59, "activeUsers": 42, "newUsersToday": 0,
  "totalPrograms": 28, "totalCertificationTracks": 93, "totalSubjectTracks": 80,
  "totalSubjects": 50, "totalTopics": 357, "totalQuestions": 5492,
  "totalQuizzes": 203, "totalLessons": 44,
  "totalQuizAttempts": 2, "totalQuestionAttempts": 276,
  "certificatesIssued": 0, "badgesAwarded": 9, "totalInterviews": 1,
  "totalActiveEnrollments": 5, "payingUsers": 0
}
```

## 3. `people` — users, growth, streaks, leaderboard

```ts
interface PeopleStats {
  users: { total: number; active: number; pending: number; blocked: number;
           admins: number; moderators: number; learners: number; withDesignation: number };
  growth: { newToday: number; newThisWeek: number; newThisMonth: number };
  streaks: { usersWithActiveStreak: number; avgCurrentStreak: number; longestStreakEver: number };
  topLearners: { id: number; name: string; image: string | null; level: string | null; points: number }[];
}
```

- `users.*` — status and role are independent axes on the same user set (`admins + moderators +
  learners === total`; that's a separate split from `active + pending + blocked === total`) — don't
  expect one breakdown's numbers to reconcile against the other's.
- `streaks.avgCurrentStreak` averages across **all** users, including everyone at 0 — a low number
  alongside a nonzero `usersWithActiveStreak` is normal.
- `topLearners` — top 5 by all-time `points`, already sorted descending. `points` is nullable;
  anyone with no total is excluded rather than shown as 0, so this can have fewer than 5 entries.

Real captured example (top 3 of 5):
```json
[
  { "id": 19, "name": "Carolin", "image": null, "level": null, "points": 2650 },
  { "id": 14, "name": "Alex Ryan", "image": null, "level": null, "points": 1160 },
  { "id": 63, "name": "Vedant Kumar", "image": null, "level": null, "points": 590 }
]
```

## 4. `content` — Programs → Certification Tracks → Subject Tracks → Subjects → Topics → Questions → Lessons

```ts
interface PublishedStats { total: number; published: number; draft: number; }

interface ContentStats {
  programs: PublishedStats; certificationTracks: PublishedStats;
  subjectTracks: PublishedStats; subjects: PublishedStats; topics: PublishedStats;
  questions: {
    total: number;
    byType: { trivia: { total: number; active: number; pending: number };
              general: { total: number; active: number; pending: number } };
    byLevel: { easy: number; intermediate: number; advanced: number };
  };
  lessons: { total: number };
  moderationQueue: { pendingQuestions: number; unpublishedSubjects: number; unpublishedTopics: number;
                      unpublishedSubjectTracks: number; unpublishedCertificationTracks: number };
}
```

- Every `{total, published, draft}` block shares one shape across all 5 entity types —
  `published + draft === total` always. One reusable stat-tile component covers all of them.
- **`certificationTracks.published`/`.draft` don't come from a column on the certification track
  itself** — a track has no publish flag of its own; it's offered through one or more job roles via
  a join table, each link independently published or not. `published` here means "offered via at
  least one currently-published job-role link"; zero links or only unpublished ones counts as
  `draft`.
- `moderationQueue` is this section's actionable widget — surface with deep-links into the
  respective admin list screens.

Real captured example:
```json
{
  "programs": { "total": 28, "published": 23, "draft": 5 },
  "certificationTracks": { "total": 93, "published": 86, "draft": 7 },
  "subjectTracks": { "total": 80, "published": 80, "draft": 0 },
  "subjects": { "total": 50, "published": 44, "draft": 6 },
  "topics": { "total": 357, "published": 354, "draft": 3 },
  "questions": {
    "total": 5492,
    "byType": { "trivia": { "total": 4948, "active": 4936, "pending": 0 }, "general": { "total": 544, "active": 544, "pending": 0 } },
    "byLevel": { "easy": 2437, "intermediate": 2150, "advanced": 905 }
  },
  "lessons": { "total": 44 },
  "moderationQueue": { "pendingQuestions": 0, "unpublishedSubjects": 6, "unpublishedTopics": 3, "unpublishedSubjectTracks": 0, "unpublishedCertificationTracks": 7 }
}
```

## 5. `engagement` — quizzes, question attempts, lesson activity

```ts
interface EngagementStats {
  quizzes: { total: number; published: number; draft: number;
             byType: { userQuiz: number; standard: number };
             playedQuizzes: number; totalPlays: number; avgPlaysPerQuiz: number; avgScore: number;
             topQuizzes: { id: number; title: string; plays: number }[] };
  questionAttempts: { total: number; correct: number; wrong: number; skipped: number;
                       distinctUsers: number; accuracyPercent: number };
  lessons: { totalViews: number; totalPending: number; totalCompleted: number; completionRate: number };
}
```

`avgPlaysPerQuiz`, `accuracyPercent`, `completionRate` are pre-guarded against divide-by-zero —
render unconditionally, they're never `NaN`. `accuracyPercent` excludes skipped questions from the
denominator (`correct / (correct + wrong)`), not counted as wrong.

Real captured example:
```json
{
  "quizzes": {
    "total": 203, "published": 139, "draft": 64, "byType": { "userQuiz": 64, "standard": 139 },
    "playedQuizzes": 2, "totalPlays": 2, "avgPlaysPerQuiz": 1, "avgScore": 75.7,
    "topQuizzes": [ { "id": 147, "title": "Quickfire REST APIs: 3 Questions, No Mercy", "plays": 1 } ]
  },
  "questionAttempts": { "total": 276, "correct": 153, "wrong": 19, "skipped": 128, "distinctUsers": 6, "accuracyPercent": 88.95 },
  "lessons": { "totalViews": 52, "totalPending": 0, "totalCompleted": 9, "completionRate": 100 }
}
```

## 6. `achievements` — certificates & badges

```ts
interface AchievementStats {
  certificates: { totalIssued: number; totalRevoked: number; totalExpired: number; uniqueHolders: number;
                  issuedThisWeek: number; issuedThisMonth: number;
                  topCertificationTracks: { id: number; title: string; issuedCount: number }[] };
  badges: { totalAvailable: number; totalAwarded: number; uniqueEarners: number;
            byScope: { global: number; subject: number; jobRole: number; topic: number };
            topBadges: { code: string; name: string; scopeType: string | null; earnCount: number }[];
            rareBadges: { code: string; name: string; scopeType: string; earnCount: number }[] };
}
```

`totalAvailable`/`totalAwarded` are the "Total"/"Earned" pair for a progress-ring widget.
`rareBadges` is computed by diffing the full published catalog against earn counts, so a
never-earned badge shows `earnCount: 0` rather than being silently absent — useful for spotting
badges with a miscalibrated auto-award rule.

Real captured example:
```json
{
  "certificates": { "totalIssued": 0, "totalRevoked": 0, "totalExpired": 0, "uniqueHolders": 0, "issuedThisWeek": 0, "issuedThisMonth": 0, "topCertificationTracks": [] },
  "badges": {
    "totalAvailable": 47, "totalAwarded": 9, "uniqueEarners": 5,
    "byScope": { "global": 7, "subject": 32, "jobRole": 0, "topic": 8 },
    "topBadges": [ { "code": "first_quiz", "name": "First Steps", "scopeType": "Global", "earnCount": 5 } ],
    "rareBadges": [ { "code": "subject_mastered", "name": "Subject Master", "scopeType": "Global", "earnCount": 0 } ]
  }
}
```

## 7. `interviews` — mock-interview pipeline

```ts
interface InterviewStats {
  total: number;
  byStatus: { scheduled: number; inProgress: number; completed: number; cancelled: number };
  roundsByStatus: { assigned: number; started: number; completed: number; declined: number; cancelled: number };
  scheduledThisWeek: number; scheduledThisMonth: number;
  completionRate: number; declineRate: number;
  topInterviewers: { id: number; name: string; roundsCompleted: number }[];
}
```

`byStatus` is the interview header's own lifecycle; `roundsByStatus` is the per-`AssessmentSession`
round lifecycle underneath it — two different granularities, don't add one's numbers to the other's.
`declineRate` is `declined / (completed + declined)`, i.e. among *resolved* rounds only (an
`assigned`/`started` round isn't counted as pending decline).

Real captured example:
```json
{
  "total": 1,
  "byStatus": { "scheduled": 1, "inProgress": 0, "completed": 0, "cancelled": 0 },
  "roundsByStatus": { "assigned": 0, "started": 0, "completed": 0, "declined": 0, "cancelled": 0 },
  "scheduledThisWeek": 0, "scheduledThisMonth": 1,
  "completionRate": 0, "declineRate": 0,
  "topInterviewers": []
}
```

## 8. `enrollments` — plan distribution & conversion (SkillEnrollment / EnrollmentBatch / SkillTierOffering)

```ts
interface EnrollmentStats {
  summary: { total: number; active: number; expired: number; cancelled: number; uniqueActiveUsers: number };
  byTier: { basic: number; curious: number; pro: number; intern: number; serious: number };
  bySource: { adminGrant: number; purchase: number; promo: number };
  conversion: { payingUsers: number; freeOnlyUsers: number; conversionRate: number };
  growth: { newToday: number; newThisWeek: number; newThisMonth: number };
  expiringSoon: number;
  topSubjectsByActiveEnrollments: { id: number; title: string; activeEnrollments: number }[];
  batches: { total: number; byStatus: { pending: number; completed: number; partiallyCompleted: number; failed: number } };
  plans: { totalActiveOfferings: number; premiumSubjectsWithoutPaidPlan: number };
}
```

- `byTier`/`bySource` count **active enrollment rows** (a user can hold several — one per subject —
  possibly at different tiers), not distinct users. `Basic` is the sole free tier; the tier ladder is
  `Basic → Curious → Pro → Intern → Serious`.
- `conversion.payingUsers` = distinct users holding at least one active tier above Basic.
  `freeOnlyUsers` = enrolled users whose every active tier is Basic. These two always sum to
  `summary.uniqueActiveUsers`.
- `expiringSoon` — active enrollments with `expiresAt` inside the next 7 days. This is the
  actionable renewal-outreach number for this section, same role `content.moderationQueue` plays
  for content.
- `batches` — `EnrollmentBatch` is the header row for a multi-subject enrollment action (e.g. "enroll
  me in every Backend Developer subject"). A `pending`/`failed` batch that isn't resolving is worth
  surfacing — it usually means a stuck or abandoned checkout.
- `plans.premiumSubjectsWithoutPaidPlan` — count of `Subject.isPremium=true` subjects with **zero**
  active `SkillTierOffering` rows: a subject gated behind payment that nobody can actually pay to
  unlock. A genuine content/business gap, worth its own callout.
- **Note**: `Basic` is always free — no `PaymentOrder` row is ever created for it, so it never
  appears in `revenue.byTier`.

Real captured example:
```json
{
  "summary": { "total": 5, "active": 5, "expired": 0, "cancelled": 0, "uniqueActiveUsers": 1 },
  "byTier": { "basic": 5, "curious": 0, "pro": 0, "intern": 0, "serious": 0 },
  "bySource": { "adminGrant": 0, "purchase": 0, "promo": 5 },
  "conversion": { "payingUsers": 0, "freeOnlyUsers": 1, "conversionRate": 0 },
  "growth": { "newToday": 0, "newThisWeek": 5, "newThisMonth": 5 },
  "expiringSoon": 0,
  "topSubjectsByActiveEnrollments": [
    { "id": 1, "title": "HTML", "activeEnrollments": 1 },
    { "id": 3, "title": "JavaScript", "activeEnrollments": 1 }
  ],
  "batches": { "total": 21, "byStatus": { "pending": 5, "completed": 16, "partiallyCompleted": 0, "failed": 0 } },
  "plans": { "totalActiveOfferings": 51, "premiumSubjectsWithoutPaidPlan": 24 }
}
```
(`batches.total` exceeding `summary.total` is expected, not a bug — a batch "completes" even when
every subject in it was already enrolled, in which case it creates zero new `SkillEnrollment` rows.)

## 9. `revenue` — PaymentOrder, always split by currency

```ts
interface CurrencyRevenueBucket {
  totalOrders: number;
  byStatus: { created: number; paid: number; failed: number; cancelled: number };
  totalPaid: number; conversionRate: number; avgOrderValue: number;
}
interface RevenueStats {
  byCurrency: { INR: CurrencyRevenueBucket; USD: CurrencyRevenueBucket };
  paidThisWeek: { INR: number; USD: number };
  paidThisMonth: { INR: number; USD: number };
  byTier: { curious: { INR: number; USD: number }; pro: { INR: number; USD: number };
            intern: { INR: number; USD: number }; serious: { INR: number; USD: number } };
}
```

- **Never sum INR and USD together** — Razorpay (INR) and Stripe (USD) are two separate ledgers.
  Every number here is pre-split; there is deliberately no blended total anywhere in this response.
- `byStatus.created` counts orders currently sitting in the `created` state (checkout requested, not
  yet resolved) — a large, growing `created` count with few `paid` is an abandoned-checkout signal,
  not necessarily a problem with the numbers.
- `conversionRate` = `paid / totalOrders`. `avgOrderValue` = `totalPaid / byStatus.paid` (0 if
  nothing's paid yet).
- `byTier` has no `basic` key — Basic is free, no order is ever created for it.

Real captured example:
```json
{
  "byCurrency": {
    "INR": { "totalOrders": 21, "byStatus": { "created": 21, "paid": 0, "failed": 0, "cancelled": 0 }, "totalPaid": 0, "conversionRate": 0, "avgOrderValue": 0 },
    "USD": { "totalOrders": 0, "byStatus": { "created": 0, "paid": 0, "failed": 0, "cancelled": 0 }, "totalPaid": 0, "conversionRate": 0, "avgOrderValue": 0 }
  },
  "paidThisWeek": { "INR": 0, "USD": 0 },
  "paidThisMonth": { "INR": 0, "USD": 0 },
  "byTier": { "curious": { "INR": 0, "USD": 0 }, "pro": { "INR": 0, "USD": 0 }, "intern": { "INR": 0, "USD": 0 }, "serious": { "INR": 0, "USD": 0 } }
}
```
(All-zero `paid` here reflects a dev environment where payment webhooks aren't firing — the
`created` orders are real checkout attempts still waiting on gateway confirmation, not a bug.)

## 10. `recentActivity` — live feed

```ts
interface RecentActivityItem {
  id: number; title: string; message: string; userId: number; userName: string | null;
  dataType: string | null; dataId: string | null; createdAt: string;
}
```

Last 15 rows, newest first, already sorted. `dataType`/`dataId` are free-form (no enum) — build a
link when you recognize the `dataType` (e.g. `"badge"`, `"USER"`), otherwise render the message
plain.

Real captured example:
```json
{ "id": 25, "title": "Badge Earned", "message": "You earned the \"Perfect Score\" badge.", "userId": 14, "userName": "Alex Ryan", "dataType": "badge", "dataId": "2", "createdAt": "2026-08-15T19:42:13.583Z" }
```

## 11. `trends` — daily & weekly time series

```ts
interface DailySeriesItem { date: string; count: number; }
interface WeeklySeriesItem { week: string; count: number; }
interface TrendSeries {
  users, questions, quizzes, attempts, certificates, badges, interviews, enrollments:
    DailySeriesItem[] | WeeklySeriesItem[];
}
interface TrendsStats { daily: TrendSeries; weekly: TrendSeries; }
```

8 series total. `daily` covers the trailing 30 days, `weekly` the trailing 8 ISO weeks — fixed
windows, not configurable. **Days/weeks with zero activity are omitted, not zero-filled** — zero-fill
client-side if your chart needs a continuous x-axis. Both arrays are already chronological
(oldest → newest). `certificates` buckets by `issuedAt`, `badges` by `earnedAt`, everything else by
the entity's own `createdAt` (including the new `enrollments` series, by `SkillEnrollment.createdAt`
— revenue is intentionally not trended here, to avoid doubling the series count with two more
currency-specific lines; use `revenue.paidThisWeek`/`.paidThisMonth` for revenue-over-time instead).

One line-chart component with a series selector (8-way dropdown/tabs) and a daily/weekly toggle
covers this whole section.

Real captured example (`daily.enrollments`, `weekly.interviews`):
```json
"daily": { "enrollments": [ { "date": "2026-08-15T18:30:00.000Z", "count": 5 } ] },
"weekly": { "interviews": [ { "week": "2026-W32", "count": 1 } ] }
```

## 12. `meta` — partial-failure resilience

```ts
interface DashboardMeta { partial: boolean; failedSections: string[]; }
```

Each of the 8 data sections is fetched independently server-side. **A query failure in one section
never fails the whole request** — it's logged server-side and that section falls back to the same
zeroed/empty shape shown throughout this doc, while every other section still returns real data.
You will never get a 400/500 from this endpoint just because one section's query broke.

Check `meta.partial` once per response. If `true`, either show a small "some data may be out of
date" banner, or treat any section named in `failedSections` as "temporarily unavailable" rather than
presenting its zeroed numbers as real zeros. If `false` (the common case, as in every example above),
ignore `meta` entirely.

## 13. Suggested widget layout

1. **KPI strip** — `overview`.
2. **People** — status donut + role chips, growth tiles, streak tiles, leaderboard (`people`).
3. **Content structure** — funnel/tree view with `{published}/{total}` progress bars, question mix,
   moderation-queue callout list (`content`).
4. **Engagement** — quiz tiles + top-quizzes leaderboard, attempt accuracy gauge, lesson completion
   gauge (`engagement`).
5. **Achievements** — two Earned/Total progress rings, top-badges/top-cert-track leaderboards,
   rare-badges callout (`achievements`).
6. **Interviews** — pipeline funnel (`byStatus`), completion/decline gauges, interviewer leaderboard
   (`interviews`).
7. **Plans & Enrollments** — tier-distribution bar (`byTier`), conversion-rate gauge, expiring-soon
   callout, top-subjects leaderboard, plan-gap callout (`enrollments`).
8. **Revenue** — a currency toggle (INR/USD, never combined) driving order-funnel and
   revenue-by-tier widgets (`revenue`).
9. **Trends chart** — 8-way series selector, daily/weekly toggle (`trends`).
10. **Recent activity** — feed/timeline sidebar (`recentActivity`).

Every section is independently fetchable from the single response — mount/unmount widgets freely
without changing the API call.

## 14. Zero-state handling

Every count and percentage defaults to `0`, never `null`/`NaN`/`undefined` — render every widget
unconditionally. Arrays (`topQuizzes`, `topCertificationTracks`, `topInterviewers`,
`topSubjectsByActiveEnrollments`, `recentActivity`, `trends.*`) can legitimately be `[]` — show an
empty-state message rather than assuming at least one entry.
