# Database Backup & Restore Safety

## The incident (2026-10-03)

The `permission` table was accidentally deleted from the dev DB and restored from a
phpMyAdmin single-table SQL dump, which failed with:

```
#1005 - Can't create table `codemeritdb2`.`permission` (errno 150 "Foreign key
constraint is incorrectly formed")
```

## Root cause

phpMyAdmin's per-table export format splits the primary key out of `CREATE TABLE` into a
trailing `ALTER TABLE ... ADD PRIMARY KEY` statement, run *after* the `INSERT`s:

```sql
CREATE TABLE `permission` (
  `id` int(11) NOT NULL,   -- no index yet
  ...
);
-- INSERT ... (rows)
ALTER TABLE `permission` ADD PRIMARY KEY (`id`);  -- PK added only here
```

At the instant `CREATE TABLE` runs, `id` has no index. If any other live table already has
an FK pointing at this table (e.g. `permission_request.permissionId -> permission.id`,
which wasn't dropped along with `permission`), InnoDB rejects the `CREATE TABLE` outright —
it requires the referenced column to already be indexed. `SET FOREIGN_KEY_CHECKS=0` does
**not** help here: that flag skips data-consistency checks, not this structural
index requirement.

This is **not specific to `permission`** — it reproduces for any table that is an FK parent
(i.e. has at least one live child table referencing it) if that parent table is restored
individually via a phpMyAdmin-style per-table dump while its children stay live. Per a
full schema audit on this date, the realistic candidates for ever being exported/restored
individually (admin-managed catalog/master data) are: `permission`, `badge`,
`certification_track`, `subject`, `topic`, `job_role`, `question`, `quiz`. Most other tables
in the schema are also FK parents of something, so the rule below applies universally
rather than table-by-table.

## The rule going forward

1. **Prefer a full-schema dump over a single-table export** whenever you need to restore
   from a backup. A full dump preserves table creation order and keeps each table's own PK
   inline, so this failure mode can't occur.
2. If you must restore a single table from a phpMyAdmin-style dump, **move the primary key
   into the `CREATE TABLE` statement inline** before running it, and drop the dump's trailing
   `ALTER TABLE ... ADD PRIMARY KEY` / `MODIFY ... AUTO_INCREMENT` statements (they become
   redundant once the PK is inline). Example fix for a dump shaped like the one above:

   ```sql
   CREATE TABLE `permission` (
     `id` int(11) NOT NULL AUTO_INCREMENT,
     ...,
     PRIMARY KEY (`id`)
   ) ENGINE=InnoDB AUTO_INCREMENT=<next_value> DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
   -- then the INSERTs, nothing else
   ```
3. Before deleting any table directly (outside the app), check whether it's an FK parent via:

   ```sql
   SELECT constraint_name, table_name AS child_table, column_name
   FROM information_schema.key_column_usage
   WHERE referenced_table_name = '<table>' AND table_schema = DATABASE();
   ```

   If children exist, plan the restore (inline PK, or full-schema dump) before you delete.

## Related follow-up (separate from this doc)

A live audit on this date also found several `ON DELETE CASCADE` foreign keys where a
master/reference table cascades deletes into transactional or entitlement data (e.g. the
`user_permission` / `permission_request` -> `permission` FKs, since fixed to `RESTRICT`).
See git history around 2026-10-03 for `fix-permission-cascade-constraints.ts`. A further
pass identified `certificate -> certification_track`, `user_badge -> badge`,
`user_lesson_tracker -> lesson`, `user_question_tracker -> question`,
`quiz_question -> question`, and borderline `user_job_role -> job_role` as the same pattern,
deferred pending a check of whether any admin delete-flow relies on the cascade today.
