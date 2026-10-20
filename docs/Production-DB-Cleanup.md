# Production DB Cleanup — Reusable Prompt & Reference

How to safely wipe transactional/test data while preserving seeded master data and
identity/account tables, ahead of a production cutover or after a round of dev/QA testing.
Written so this can be re-run from a fresh conversation without redoing the full discovery
work each time.

## 1. The prompt

Paste this into a new conversation to kick off the workflow:

> I need to clean transactional/test data from the codemerit-api database while preserving
> all seeded master data and the `user`/`user_otp`/`profile` tables. Follow the methodology in
> `codemerit-api/docs/Production-DB-Cleanup.md` exactly:
>
> 1. Enumerate every `@Entity` in `src/common/typeorm/entities/` (don't rely on the table list
>    already in this doc — re-verify, since new entities may have been added since it was
>    written).
> 2. For any entity not already classified in this doc's reference table, classify it as
>    **Master/reference data** (keep) or **Transactional/user-activity data** (candidate to
>    clear), with a one-sentence reason, and get its live row count.
> 3. Flag anything genuinely ambiguous instead of guessing — identity/account-linkage data
>    (social login IDs, etc.), access-control/RBAC state, or anything else that isn't clearly
>    an activity log. Ask me explicitly before including it either way.
> 4. Check actual FK constraints via `information_schema.REFERENTIAL_CONSTRAINTS` (not just
>    entity `@Column`/`@ManyToOne` decorators — the live schema can drift from the code) for
>    every candidate table, both directions: what points at it, and what it points at. Use
>    that to determine a safe deletion order and confirm nothing being cleared has a
>    non-`CASCADE` FK dependency that would block the delete, and confirm nothing preserved
>    (`user`, `user_otp`, master tables) would be affected.
> 5. Present the complete final table list (what's being cleared, with row counts, and what's
>    explicitly being preserved) and get my explicit go-ahead before running anything. Never
>    auto-execute a DELETE across multiple tables without that confirmation, even if I've
>    approved a similar list before — always confirm the specific tables and counts for this run.
> 6. Build one idempotent one-off script (following `add-certification-columns.ts`'s /
>    `split-standard-userquiz.ts`'s established conventions: `AppDataSource`, a `queryRunner`
>    transaction, before/after row-count logging, a JSON report written to `.backup/`) that:
>    - Deletes rows from the confirmed tables in the safe order from step 4.
>    - Resets `AUTO_INCREMENT` only on tables that land at exactly 0 rows afterward — never on
>      a table that still has rows (e.g. a master table, or a candidate table you decided not
>      to clear this run).
> 7. Run it, then independently verify: every table meant to be cleared is at 0, every
>    preserved table's row count is unchanged from before the run.
> 8. Clean up any temporary verification scripts/files you created along the way.
>
> Tell me the final classification and get my sign-off before touching the database.

## 2. Why this much ceremony

This is destructive, and "transactional" vs "master data" isn't always obvious from a table
name alone — e.g. `user_permission` looks like activity but is actually live RBAC state, and
`profile` is per-user but holds social-login identity linkage, not a log of something that
happened. Guessing wrong here either leaves stale test data in a production launch or breaks
real account state. The methodology exists to make each classification an explicit,
reviewable decision rather than an assumption.

## 3. Reference classification (as of 2026-09-04)

Re-verify row counts each run — this snapshot is from the last cleanup pass, not live. If new
entities exist that aren't in this list, classify them fresh per the prompt above and add them
here.

### Master/reference data — never clear
`subject`, `topic`, `question`, `question_option`, `question_topic`, `lesson`, `lesson_section`,
`skill_tier_offering`, `skill_metric`, `subject_track`, `subject_track_topic`, `job_role`,
`job_role_subject`, `permission`, `badge`, `badge_rule`, `certification_track`,
`certification_track_subject_track`, `certification_track_job_role`,
`enrollment_tier_cap_config`, `quiz`, `quiz_question`, `quiz_settings`, `quiz_subject`,
`quality_metric` (catalog of SME review issue tags, admin/seed-managed — added 2026-09-04).

### Preserved regardless of classification (explicit user instruction)
`user`, `user_otp`, `profile` — the last of these is per-user but holds identity/social-login
linkage (`googleId`/`linkedinId`/`linkedinAccessToken`), not activity history, so it's grouped
with the account tables rather than cleared by default. Re-confirm this each run in case the
instruction changes.

### Transactional/user-activity data — cleared in the last pass
`user_quiz`, `quiz_result`, `question_attempt`, `quiz_topic` (UserQuiz-linked rows only, via
cascade), `skill_enrollment`, `enrollment_batch`, `payment_order`, `certificate`, `user_badge`,
`user_xp_log`, `user_streak`, `notifications`, `activity`, `api_usage`, `user_job_role`,
`user_lesson_tracker`, `free_lesson_view`, `skill_rating`, `permission_request`, `interview`,
`interview_status_history`, `assessment_session`, `user_permission` (cleared per explicit
confirmation — this one is live RBAC state, re-confirm every run rather than assuming),
`quality_review`, `quality_review_tag` (SME question-quality review activity — added 2026-09-04).

### Known dead entities — no table exists, nothing to clean up
`linkedin_share` (`linkedin-share.entity.ts`) has entity code but was never migrated into this
database (`synchronize: false`, no migration ran). Not a cleanup concern unless/until that
feature actually ships a table. (`hint.entity.ts`, previously in this category, has since been
removed from the codebase entirely — no longer applicable.)

### Deletion order dependencies (within the transactional set, confirmed via `information_schema`)
`interview_status_history` and `skill_rating` both reference `assessment_session`;
`assessment_session` references `interview` — deleted children-first:
`interview_status_history` → `skill_rating` → `assessment_session` → `interview`.
`quality_review_tag` references `quality_review` (`CASCADE`) — deleted before it.
`question_attempt` and `quiz_result` both reference `user_quiz` (`SET NULL`); `user_quiz`'s own
DB-level cascade removes its linked `quiz_question`/`quiz_settings`/`quiz_subject`/`quiz_topic`
rows automatically, so `quiz_topic` doesn't need an explicit delete — just a before/after count
check to confirm the cascade worked. Every other table in the transactional set has no FK
dependency on another table in the set, so order among the rest doesn't matter. Re-verify this
against `information_schema` each run — don't
assume it hasn't changed if new FKs were added since.

## 4. Prior runs

- **2026-09-01**: First pass. Cleared `user_quiz`/`quiz_result`/`question_attempt`/`quiz_topic`
  (confirmed pure test-account activity from a Quiz/UserQuiz-split bug investigation), then the
  full transactional set above. See `.backup/clean-userquiz-and-activity-report-*.json` and
  `.backup/clean-transactional-data-report-*.json` for the exact before/after counts.
- **2026-09-04**: Second pass, using the reusable prompt in this doc. Found 3 new entities
  (`quality_metric`/`quality_review`/`quality_review_tag`, from the Quality Review feature
  shipped since the last pass) — classified `quality_metric` as master, the other two as
  transactional. All master-data counts had grown from legitimate seeding work between passes
  (e.g. `question` 5546→5576, `certification_track` 28→151); all transactional tables had
  accumulated new rows from continued dev/QA testing, traced to 5 confirmed test/QA accounts
  before clearing. `clean-transactional-data-for-prod.ts` updated in place to be the one
  canonical, reusable script (folded in the two prior separate scripts' scope) rather than
  creating a new dated file each run. See
  `.backup/clean-transactional-data-report-*.json` (latest) for exact counts.
