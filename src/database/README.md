# Database Seeder

This document covers how to seed the database and how to refresh the seed data from a live DB.

---

## Quick Reference

| Task | Command | Notes |
|---|---|---|
| Seed everything (permissions, subjects, curriculum, questions) | `npm run seed` | Idempotent — safe to re-run, matches every record by slug and skips what already exists |
| Refresh the seed snapshot from the current DB | `npm run seed:snapshot` | Overwrites `seeds/data/*.seed.json` with the live DB state |
| Generate standard quizzes from seeded questions | `npm run seed:quizzes` | Separate concern — quiz generation, not raw data |
| Create / update the schema | `npm run migration:run` | Applies pending migrations from `migrations/` |
| See which migrations are applied | `npm run migration:show` | `[X]` = applied |

---

## Schema & Migrations

The schema starts from a single baseline, `migrations/<ts>-BaselineSchemaV1.ts`, which
replaced all pre-release migrations before the first production launch. A fresh database
is built with:

```bash
npm run migration:run   # creates every table from the baseline
npm run seed            # loads curriculum, questions, lessons
```

**Column order convention.** TypeORM creates columns in the order properties are declared
in the entity (`id` from `AbstractEntity` first). Keep that order when adding fields:
`id` → foreign keys / identity (`userId`, `code`, `title`, `slug`) → business columns →
audit columns last (`createdBy`, `updatedBy`, `createdAt`, `updatedAt`, `deletedAt`).
New columns added later by `ALTER TABLE` land at the end of existing tables. That is fine,
since order has no functional effect, but declare them in the right place in the entity so
fresh environments get the intended order.

**Writing new migrations.** `migration:generate` against a local **MariaDB** produces
false positives: it re-`CHANGE`s every nullable column (MariaDB reports `DEFAULT NULL`
differently) and the FKs/indexes on them. Strip that noise and keep only the real
change, or hand-write the migration (as most pre-release ones were). Anything that only
exists as raw SQL (generated columns, FKs without a relation, named indexes) must also be
declared in the entity, or `migration:generate` will propose dropping it. See
`SkillEnrollment.activeGuardKey`.

---

## What `npm run seed` Does

The seeder is the **authoritative source of truth** — it fully reproduces the curriculum + question bank from four JSON snapshot files. It runs in this order:

```
1. Permissions       — synced from UserPermissionEnum (00-permission.seeder.ts)
        ↓
2. Core              — job roles + subjects, upserted by slug (01-core.seeder.ts ← data/01-core.seed.json)
        ↓
3. Curriculum        — topics + subject tracks + track↔topic links, upserted by slug (02-curriculum.seeder.ts ← data/02-curriculum.seed.json)
        ↓
4. Programs          — job-role↔subject links + certification tracks + cert↔track links (03-programs.seeder.ts ← data/03-programs.seed.json)
        ↓
5. Questions         — questions + options + topic links, upserted by slug (04-question.seeder.ts ← data/04-questions.seed.json)
        ↓
6. Lessons           — lessons + sections, upserted by slug (05-lesson.seeder.ts ← data/05-lessons.seed.json)
```

Every step matches by a natural key (slug, or a unique composite key for join tables) and **skips** records that already exist — nothing is ever cleared or overwritten. Running `npm run seed` twice in a row is a no-op the second time.

```bash
npm run seed
```

---

## Refreshing the Snapshot

The four `data/*.seed.json` files are a point-in-time export of the database. If you add or edit curriculum/questions through the API (not through the seeder), refresh the snapshot before committing so a fresh environment can reproduce the current state:

```bash
npm run seed:snapshot
```

This overwrites `src/database/seeds/data/01-core.seed.json` through `04-questions.seed.json` with the live DB content. Review the diff before committing — it's a full re-dump, not a merge.

---

## File Structure

```
src/database/
├── data-source.ts                      Standalone TypeORM DataSource (used by seed.ts and scripts)
├── README.md                           This file
├── scripts/
│   ├── export-seed-snapshot.ts         ← npm run seed:snapshot
│   └── seed-standard-quizzes.ts        ← npm run seed:quizzes
└── seeds/
    ├── seed.ts                         Main orchestrator — npm run seed
    ├── data/
    │   ├── 01-core.seed.json           Job roles, subjects
    │   ├── 02-curriculum.seed.json     Topics, subject tracks, track↔topic links
    │   ├── 03-programs.seed.json       Job-role↔subject links, certification tracks, cert↔track links
    │   ├── 04-questions.seed.json      Questions, options, topic links
    │   └── 05-lessons.seed.json        Lessons + rich-text sections (slider notes)
    └── seeders/
        ├── 00-permission.seeder.ts     Code-driven from UserPermissionEnum (not from a JSON snapshot)
        ├── 01-core.seeder.ts
        ├── 02-curriculum.seeder.ts
        ├── 03-programs.seeder.ts
        ├── 04-question.seeder.ts
        └── 05-lesson.seeder.ts
```

---

## Technical Details

### Matching keys

| Entity | Matched by |
|---|---|
| JobRole, Subject | `slug` |
| Topic, SubjectTrack | `slug` (global unique) |
| SubjectTrackTopic | `(subjectTrackId, topicId)` |
| JobRoleSubject | `(jobRoleId, subjectId)` |
| CertificationTrack | `(jobRoleId, title)` |
| CertificationTrackSubjectTrack | `(certificationTrackId, subjectTrackId)` |
| Question | `slug` (global unique, max 48 chars) |
| Lesson | `slug` (global unique) |

### Lessons

A `Lesson` is a short slider of concise notes about one subject/topic — each `LessonSection.description` is rendered as raw HTML client-side (no markdown parsing), so use `<p>`, `<code>`, `<pre><code>...</code></pre>` for code snippets, etc. directly. `Lesson.userId` (author) is required and not nullable; the seeder resolves it at seed time by looking up a user with `role='Admin'` rather than hardcoding an id — if no Admin user exists yet, lesson seeding is skipped with a warning (everything else still seeds).

The current `05-lessons.seed.json` is a starter set (3 lessons each for JavaScript, React, and Git) meant as a content template — add more entries in the same shape (`slug`, `title`, `subjectSlug`, `topicSlug`, `level`, `sections: [{ title, description }]`) to expand coverage, or author lessons via the `POST /apis/lesson/create` API and pull them into the snapshot with `npm run seed:snapshot`.

### Credentials & environment

`data-source.ts` reads env vars first, then falls back to hardcoded dev defaults. **Empty string is honoured** — setting `DB_PASSWORD=` in `.env` connects with no password (common for local XAMPP/WAMP root).

| Variable | Hardcoded default |
|---|---|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USERNAME` | `codemerituser` |
| `DB_PASSWORD` | `GwjU067FL8hcmjQkXjaM` |
| `DB_DATABASE` | `codemeritdb` |

Create a `.env` file at the project root to override. Example for a local XAMPP setup:

```env
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=codemeritdb
```

---

## Common Mistakes

**`npm run seed` doesn't pick up my API changes** — The seeder only reads `data/*.seed.json`. Run `npm run seed:snapshot` first to refresh those files from the live DB, then commit them.

**Import fails with "Subject not found" / "Topic not found" warnings** — A `subjectSlug` or `topicSlug` in the JSON doesn't match a `slug` column in the DB. This usually means the snapshot is out of sync with the DB you're seeding into — re-run `npm run seed:snapshot` against the source DB.

**`npm run seed` fails with access denied** — Check your `.env` file. `DB_PASSWORD=` (empty string, not omitted) is required for local MySQL root with no password.
