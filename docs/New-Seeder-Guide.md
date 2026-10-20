# Guide: Adding a New Seeder

Use this when you need to seed a brand-new entity/table that doesn't have a seeder yet.
If the entity already has one (subjects, topics, questions, lessons, badges, job roles,
subject tracks, certification tracks, permissions), you almost certainly don't need this —
see **[Database-Seeding.md](Database-Seeding.md) §5** instead, which covers adding more
*rows* to an existing seeder.

## Before you start: pick a natural key

Every seeder in this repo matches rows by something stable and human-readable — a `slug`,
a `title`, a `code` — never by database ID. IDs differ across environments (dev, staging,
a teammate's fresh DB); slugs don't. If your entity doesn't already have a unique,
human-assignable field, add one before writing the seeder.

## Step-by-step

### 1. Create the data file

`src/database/seeds/data/NN-yourthing.seed.json`, where `NN` is the next number after the
last existing seeder step (keep them sequential — the number is also the run order, see
step 4). Shape is up to you, but look at `01-core.seed.json`'s old shape (job roles/subjects
as `{ title, slug, ... }` arrays) or `04-question.seeder.ts`'s `QuestionData` interface for
the convention: a flat array or a small object of arrays, every foreign reference expressed
as a slug/title string, not a numeric ID.

### 2. Write the seeder function

`src/database/seeds/seeders/NN-yourthing.seeder.ts`. Minimum shape:

```ts
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { YourEntity } from 'src/common/typeorm/entities/your-entity.entity';

const DATA_FILE = path.join(__dirname, '../data/NN-yourthing.seed.json');

interface YourThingData {
  slug: string;
  title: string;
  // ...whatever fields, referencing related rows by slug/title, not id
}

export async function seedYourThing(dataSource: DataSource /* + any rows from earlier steps you depend on */): Promise<YourEntity[]> {
  const data: YourThingData[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const repo = dataSource.getRepository(YourEntity);

  let created = 0;
  for (const item of data) {
    const exists = await repo.findOne({ where: { slug: item.slug } });
    if (!exists) {
      await repo.save(repo.create(item));
      created++;
    }
  }

  const all = await repo.find();
  console.log(`  ✔ YourThing: ${all.length} records (${created} created)`);
  return all;
}
```

This is the **skip-if-exists** pattern — the right default for almost everything. It's safe
to re-run and never clobbers data you've since edited by hand or through the app.

**Only** reach for the update-in-place pattern (see `05-lesson.seeder.ts`) if the JSON file
is genuinely meant to be the ongoing source of truth for that content, so re-running the
seeder should push edits live. If you do this:
- Update fields on the existing row — never delete-and-recreate it (that orphans/loses any
  child rows or user-generated data hanging off its ID).
- Never touch tables that record user activity against that row (progress trackers,
  attempts, etc.) — those aren't part of what "reseeding" should reset.

### 3. Handle missing references gracefully

If your data references another entity by slug (e.g. a subject), look it up and `continue`
with a `console.warn` if it's not found — don't throw. One bad row in a large JSON file
shouldn't abort the whole seed run. Every existing seeder follows this (see the
`⚠` warnings in `01-core.seeder.ts` / `02-curriculum.seeder.ts`).

### 4. Wire it into `seed.ts`

Open `src/database/seeds/seed.ts` and add your step in the right position — **before**
anything that depends on it, **after** anything it depends on:

```ts
import { seedYourThing } from './seeders/NN-yourthing.seeder';
// ...
console.log('\nSeeding your thing...');
await seedYourThing(AppDataSource /*, ...whatever earlier steps produced that you need */);
```

### 5. (Optional) Add an npm script if it's useful standalone

Only bother if you expect to run this step on its own often (see `seed:lessons` /
`seed:quizzes` in `package.json` as examples):

```json
"seed:yourthing": "ts-node -r tsconfig-paths/register src/database/scripts/seed-yourthing.ts"
```

where that script is a thin wrapper that connects `AppDataSource` and calls your seeder
directly (copy `src/database/scripts/seed-lessons.ts`).

## Checklist before you're done

- [ ] Data file uses a natural key (slug/title/code), not IDs, for every reference.
- [ ] Seeder matches existing rows by that natural key before inserting.
- [ ] Missing references warn-and-skip, they don't throw.
- [ ] Chose skip-if-exists unless you have a specific reason to update-in-place (and if you
      did, confirmed it never deletes the parent row or touches user-generated child data).
- [ ] Registered in `seed.ts` in the correct dependency order.
- [ ] Ran `npm run seed` twice in a row locally — second run should create 0 new rows.
- [ ] Console output reports a count, matching the style of the other seeders
      (`✔ X: N records (M created)`).

## Testing locally

```bash
npm run seed
```

Check the console output for your step's summary line and confirm the count matches your
JSON file. Run it a second time immediately after — it should report `0 created` for your
step, confirming the natural-key matching works and nothing duplicates.
