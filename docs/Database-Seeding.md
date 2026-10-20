# Database Seeding — Tutorial & Reference

How this NestJS app gets its reference/content data into the database, and which files do
what. Written for anyone who wants to load more data into CodeMerit — not just the original
authors.

## 1. What "seeding" means here

A NestJS app talks to its database through TypeORM entities, but entities only define
*shape* — they don't put any rows in the tables. "Seeding" is a small standalone script that
connects to the database directly (via the same TypeORM `DataSource`, outside the HTTP
request lifecycle) and inserts the baseline data the app needs to be usable: subjects, job
roles, topics, questions, lessons, badges, permissions.

This repo's version of that pattern lives entirely under `src/database/`.

## 2. How it's implemented here

```
npm run seed
      │
      ▼
src/database/seeds/seed.ts               (orchestrator — runs steps 00 → 06 in order)
      │
      ├─ 00-permission.seeder.ts         (code-driven, no JSON file)
      ├─ 01-core.seeder.ts        ◄── src/database/seeds/data/01-core.seed.json
      ├─ 02-curriculum.seeder.ts  ◄── src/database/seeds/data/02-curriculum.seed.json
      ├─ 03-programs.seeder.ts   ◄── src/database/seeds/data/03-programs.seed.json
      ├─ 04-question.seeder.ts   ◄── src/database/seeds/data/04-questions.seed.json
      ├─ 05-lesson.seeder.ts     ◄── src/database/seeds/data/05-lessons.seed.json
      └─ 06-badges.seeder.ts     ◄── src/database/seeds/data/06-badges.seed.json
      │
      ▼
src/database/data-source.ts   (the plain TypeORM DataSource these scripts connect through —
                                same entities as the app, but no NestJS DI, no HTTP server)
```

Two things make this simple to reason about:

- **Each seeder is just a function** — `seedCore(dataSource)`, `seedQuestions(dataSource,
  subjects, topics)`, etc. `seed.ts` calls them in order and passes the rows one step created
  into the next step that needs them (e.g. curriculum needs the subjects core just created).
- **Each JSON data file uses natural keys, not database IDs** — slugs, titles, code strings.
  That's what makes the files portable across environments: a fresh database has different
  auto-increment IDs than yours, but the same slugs.

## 3. Related files and their role

| File | Role |
|---|---|
| `src/database/data-source.ts` | The `DataSource` every seed/maintenance script connects through. Lists every entity; `synchronize: false` (seeders never alter schema, only rows). |
| `src/database/seeds/seed.ts` | Orchestrator. Runs all seeders in dependency order. Entry point for `npm run seed`. |
| `src/database/seeds/seeders/00-permission.seeder.ts` | Syncs `Permission` rows from the `UserPermissionEnum` source code — no JSON file, so new enum values are always picked up automatically. |
| `src/database/seeds/seeders/01-core.seeder.ts` | Job roles + subjects. Everything else depends on these existing first. |
| `src/database/seeds/seeders/02-curriculum.seeder.ts` | Topics, subject tracks, and the topic↔track links. Depends on subjects. |
| `src/database/seeds/seeders/03-programs.seeder.ts` | Job-role↔subject links, certification tracks, and their links to job roles/subject tracks. |
| `src/database/seeds/seeders/04-question.seeder.ts` | Questions, their options, and question↔topic links. |
| `src/database/seeds/seeders/05-lesson.seeder.ts` | Lessons and lesson sections. |
| `src/database/seeds/seeders/06-badges.seeder.ts` | Badges and their earn-rules. |
| `src/database/seeds/data/*.seed.json` | The actual data each seeder above reads. One file per seeder, same numeric prefix. |
| `src/database/scripts/export-seed-snapshot.ts` | The reverse direction: dumps the **current live database** back out into `01`, `02`, `03`, `04`, `05` (not badges) as fresh JSON, keyed by the same natural keys. Run via `npm run seed:snapshot`. |
| `src/database/scripts/export-programs-snapshot.ts` | Same idea, scoped to just `03-programs.seed.json`. |
| `src/database/scripts/seed-lessons.ts` | Thin runner that calls `05-lesson.seeder.ts` on its own, without running the full pipeline. `npm run seed:lessons`. |
| `src/database/scripts/seed-standard-quizzes.ts` / `seed-production-quizzes.ts` | Build `Standard` quiz catalog entries from existing questions via `QuizService.createQuiz()` — not part of the row-seeding pipeline above, but adjacent content tooling. `npm run seed:quizzes`. |

### One-off maintenance scripts (also in `src/database/scripts/`)

These aren't part of the seed pipeline — they're targeted, re-runnable tools for fixing or
re-syncing data that's already in the database. Listed here because they read/write the same
JSON files and are easy to confuse with the seeders above.

| File | Role |
|---|---|
| `update-subject-copy.ts` | Re-syncs `description`/`body`/`scope` on **existing** subjects from `01-core.seed.json`, matched by slug. Unlike `01-core.seeder.ts` (insert-only), this always updates in place. |
| `update-job-role-subjects.ts` | Re-syncs `tag`/`sortOrder`/`note` on **existing** job-role↔subject links from `03-programs.seed.json`. |
| `update-question-content.ts` | Re-syncs `level`/`answer`/option-correctness on **existing** questions from `04-questions.seed.json`, matched by slug, one subject at a time. |
| `update-angular-cert-ladder.ts`, `update-cert-audit-round2.ts` | One-time, hand-written data fixes for specific certification tracks. Not data-file-driven — read them before reusing. |
| `dedup-questions.ts`, `dedup-backup.ts`, `dedup-verify.ts` | Find/remove duplicate questions, with a pre-op backup and a post-op verification step. |
| `renumber-question-ids.ts`, `renumber-topic-quiz-ids.ts` | ID-renumbering utilities used during the dedup cleanup. |
| `backfill-questions.ts`, `apply-quality-review.ts` | Bulk content-quality passes over existing questions from an external review file. |
| `_backup-badge-tables.ts` | Ad hoc badge table backup (leading `_` = not part of any regular workflow). |

## 4. Running it

```bash
npm run seed
```

Runs all 7 steps (00 → 06) against whatever database your `.env` points at. **It's
idempotent** — every seeder matches incoming rows by their natural key (slug, title, or
similar) and skips ones that already exist, so re-running it is always safe and only adds
what's missing. See §6 for the one exception.

To seed just one thing:

```bash
npm run seed:lessons     # lessons only
npm run seed:quizzes     # standard quiz catalog only
```

There's no `seed:questions`-style single-step command for the others today — running the
full `npm run seed` is cheap because every already-seeded row is skipped instantly.

## 5. Adding more data with what already exists

If you just want to add more rows to a subject/topic/question/etc. that already has a
seeder, you don't need to touch any TypeScript:

1. Open the matching JSON file, e.g. `src/database/seeds/data/04-questions.seed.json`.
2. Append new entries following the existing shape (check the seeder's `interface` at the
   top of the file for the exact fields — e.g. `QuestionData` in `04-question.seeder.ts`).
3. Reference other rows by **slug**, not ID (`subjectSlug`, `topicSlugs`, etc.).
4. Run `npm run seed`. Only your new entries (new slugs) get inserted — nothing existing is
   touched.

## 6. The two idempotency patterns

Every seeder picks one of two behaviors on a slug match — know which one you're dealing with:

- **Skip-if-exists** (`00`, `01`, `02`, `03`, `04`, `06`): if a row with that natural key
  already exists, it's left completely alone. Safe default — running the seed script never
  silently overwrites something you changed by hand in the DB afterward.
- **Update-in-place** (`05-lesson.seeder.ts`): a slug match updates the lesson's fields and
  **replaces its sections**, but never deletes/recreates the `Lesson` row itself, and never
  touches `UserLessonTracker`. This is deliberate — lesson content is meant to be
  authoritative from the JSON file, so a copy fix actually takes effect on the next
  `npm run seed`. (An earlier version fully deleted-and-recreated the lesson on every match,
  which silently wiped learner progress — don't reintroduce that.)

The `update-*.ts` maintenance scripts (§3) exist precisely because most seeders are
skip-if-exists: they're the "I need to re-sync existing rows" escape hatch, run by hand,
one entity type at a time.

## 7. Current state of `src/database/seeds/data/`

As of 2026-08-20, only `06-badges.seed.json` is present. The `01`–`05` files were
deleted from the repo (their content was already loaded into the live database, which is
backed up separately) — see git history if you need the last version. Practically, this
means:

- `npm run seed` will now fail at whichever step it reaches first once its data file is
  missing (currently step `01`).
- To make `npm run seed` fully runnable again, regenerate the files from the current
  database: `npm run seed:snapshot` (covers `01`–`05`) writes fresh files reflecting
  whatever is in the DB right now.
- If you're adding brand-new content and don't need a full from-scratch reseed capability,
  you don't need to do anything — just work directly against the database, or create a new,
  small JSON file scoped to what you're adding and run a one-off script over it (see the
  companion **New Seeder Guide**).

## See also

- **[New-Seeder-Guide.md](New-Seeder-Guide.md)** — how to add a brand-new seeder for a new
  entity/table.
