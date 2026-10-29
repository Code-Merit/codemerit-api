import { AppDataSource } from '../data-source';
import * as fs from 'fs';
import * as path from 'path';
import { EntityManager } from 'typeorm';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { TopicLabelEnum } from 'src/common/enum/topic-label.enum';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { LessonSection } from 'src/common/typeorm/entities/lesson-section.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { LessonAccessLevelEnum } from 'src/common/enum/lesson-access-level.enum';
import { sanitizeLessonHtml } from 'src/common/utils/lesson-html-sanitizer.util';

// Scoped, idempotent seed for TypeScript topic copy and lessons. Unlike seed-nx.ts and seed-expressjs.ts it
// does not touch tracks, certificates, job roles, questions or badges: the TypeScript curriculum already
// exists, so only the topic text (02-curriculum) and this subject's lessons (05-lessons) are synced. Topics
// are matched by slug and must already exist. Safe to re-run at any time:
//   npx ts-node -r tsconfig-paths/register src/database/seeds/seed-typescript.ts

const SUBJECT_SLUG = 'typescript';
const DATA = path.join(__dirname, 'data');

const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf-8'));

async function syncTopicCopy(m: EntityManager, subject: Subject) {
  const topicsData = readJson('02-curriculum.seed.json').topics.filter((t: any) => t.subjectSlug === SUBJECT_SLUG);
  for (const t of topicsData) {
    const existing = await m.findOneBy(Topic, { slug: t.slug });
    if (!existing) throw new Error(`Topic ${t.slug} is in the seed JSON but not in the DB`);
    if (existing.subjectId !== subject.id) throw new Error(`Topic slug ${t.slug} belongs to another subject (t${existing.id})`);
    await m.update(Topic, existing.id, {
      title: t.title, label: t.label as TopicLabelEnum, shortDesc: t.shortDesc, description: t.description, goal: t.goal,
    });
  }
  const declared = new Set(topicsData.map((t: any) => t.slug));
  for (const t of await m.find(Topic, { where: { subjectId: subject.id } })) {
    if (!declared.has(t.slug)) console.warn(`  ⚠ topic in DB but not in seed JSON: ${t.slug} (t${t.id})`);
  }
  console.log(`  ✔ Topics: ${topicsData.length} updated`);
}

// A slug match updates the lesson's fields and its sections in place by position (orderIndex), adding or
// removing only the difference, so re-running the seed never burns lesson_section ids. Never deletes the
// Lesson row or touches UserLessonTracker.
async function syncLessons(m: EntityManager, subject: Subject) {
  const lessons = readJson('05-lessons.seed.json').filter((l: any) => l.subjectSlug === SUBJECT_SLUG);
  if (!lessons.length) { console.log('  ✔ Lessons: none declared yet'); return; }
  const author = await m.findOne(User, { where: { role: UserRoleEnum.ADMIN }, order: { id: 'ASC' } });
  if (!author) throw new Error('No Admin user found to author lessons (lesson.userId is required)');
  const topics = await m.find(Topic, { where: { subjectId: subject.id } });
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
  let created = 0, updated = 0, sections = 0;

  for (const l of lessons) {
    const topic = topicBySlug.get(l.topicSlug);
    if (!topic) throw new Error(`Lesson ${l.slug} references unknown topic ${l.topicSlug}`);
    const fields = {
      title: l.title, summary: l.summary, subjectId: subject.id, topicId: topic.id, level: l.level,
      format: l.format ?? 'tutorial', accessLevel: (l.accessLevel ?? LessonAccessLevelEnum.Basic) as LessonAccessLevelEnum,
      tags: l.tags ?? null,
    };
    let lesson = await m.findOneBy(Lesson, { slug: l.slug });
    if (lesson) {
      await m.update(Lesson, lesson.id, fields);
      updated++;
    } else {
      lesson = await m.save(m.create(Lesson, { slug: l.slug, userId: author.id, ...fields }));
      created++;
    }
    const existing = await m.find(LessonSection, { where: { lessonId: lesson.id }, order: { orderIndex: 'ASC', id: 'ASC' } });
    for (const [index, s] of l.sections.entries()) {
      const row = { title: s.title, content: sanitizeLessonHtml(s.content), orderIndex: index };
      if (existing[index]) await m.update(LessonSection, existing[index].id, row);
      else await m.save(m.create(LessonSection, { lessonId: lesson.id, ...row }));
      sections++;
    }
    const extra = existing.slice(l.sections.length);
    if (extra.length) await m.delete(LessonSection, extra.map((x) => x.id));
  }
  console.log(`  ✔ Lessons: ${lessons.length} declared (${created} created, ${updated} updated in place, ${sections} sections)`);
}

async function main() {
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (m) => {
      const subject = await m.findOneByOrFail(Subject, { slug: SUBJECT_SLUG });
      console.log('Topic copy...');
      await syncTopicCopy(m, subject);
      console.log('Lessons...');
      await syncLessons(m, subject);
    });
    console.log('\nDone.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('\nSeeding failed (transaction rolled back):', err);
  process.exit(1);
});
