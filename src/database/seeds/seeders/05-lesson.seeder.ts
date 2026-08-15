import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { LessonSection } from 'src/common/typeorm/entities/lesson-section.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { sanitizeLessonHtml } from 'src/common/utils/lesson-html-sanitizer.util';

const DATA_FILE = path.join(__dirname, '../data/05-lessons.seed.json');

interface LessonData {
  slug: string;
  title: string;
  subjectSlug: string;
  topicSlug: string;
  level: 1 | 2 | 3;
  summary: string;
  format?: 'comic' | 'tutorial' | 'reference';
  tags?: string[];
  sections: Array<{ title: string; content: string }>;
}

/** Lessons are the one entity where the seed JSON is meant to be authoritative for content
 * (so a copy fix in the JSON actually takes effect on reseed), so a slug match updates the
 * lesson's fields and replaces its sections in place — rather than the plain skip-if-exists
 * every other seeder uses. Crucially this NEVER deletes/recreates the `Lesson` row itself and
 * NEVER touches `UserLessonTracker` — a prior version deleted and fully recreated the lesson
 * (sections and progress trackers included) on every slug match, which silently wiped learner
 * progress and any live-authored content any time `npm run seed` was re-run. */
export async function seedLessons(dataSource: DataSource, subjects: Subject[], topics: Topic[]): Promise<void> {
  const data: LessonData[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const lessonRepo = dataSource.getRepository(Lesson);
  const sectionRepo = dataSource.getRepository(LessonSection);

  const author = await dataSource.getRepository(User).findOne({ where: { role: UserRoleEnum.ADMIN } });
  if (!author) {
    console.warn('  ⚠  No Admin user found — skipping lesson seeding (lesson.userId is required)');
    return;
  }

  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

  let created = 0;
  let updated = 0;
  let sectionsCreated = 0;

  for (const l of data) {
    const subject = subjectBySlug.get(l.subjectSlug);
    const topic = topicBySlug.get(l.topicSlug);
    if (!subject || !topic) {
      console.warn(`  ⚠  Lesson "${l.slug}": subject "${l.subjectSlug}" or topic "${l.topicSlug}" not found`);
      continue;
    }

    const existing = await lessonRepo.findOne({ where: { slug: l.slug } });

    let lessonId: number;
    if (existing) {
      await lessonRepo.update(existing.id, {
        title: l.title,
        summary: l.summary,
        subjectId: subject.id,
        topicId: topic.id,
        level: l.level,
        format: l.format ?? 'tutorial',
        tags: l.tags ?? null,
      });
      await sectionRepo.delete({ lessonId: existing.id });
      lessonId = existing.id;
      updated++;
    } else {
      const lesson = await lessonRepo.save(
        lessonRepo.create({
          title: l.title,
          summary: l.summary,
          subjectId: subject.id,
          topicId: topic.id,
          slug: l.slug,
          level: l.level,
          format: l.format ?? 'tutorial',
          tags: l.tags ?? null,
          userId: author.id,
        }),
      );
      lessonId = lesson.id;
      created++;
    }

    for (const [index, s] of l.sections.entries()) {
      const entity = sectionRepo.create({
        lessonId,
        title: s.title,
        content: sanitizeLessonHtml(s.content),
        orderIndex: index,
      });
      await sectionRepo.save(entity);
      sectionsCreated++;
    }
  }

  console.log(`  ✔ Lessons : ${data.length} declared (${created} created, ${updated} updated in place)`);
  console.log(`  ✔ Sections: ${sectionsCreated} created`);
}
