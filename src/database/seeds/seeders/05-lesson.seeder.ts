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

const DATA_FILE = path.join(__dirname, '../data/05-lessons.seed.json');

interface LessonData {
  slug: string;
  title: string;
  subjectSlug: string;
  topicSlug: string;
  level: 1 | 2 | 3;
  format?: 'comic' | 'tutorial' | 'reference';
  tags?: string[];
  sections: Array<{ title: string; description?: string; blocks?: object[] }>;
}

export async function seedLessons(dataSource: DataSource, subjects: Subject[], topics: Topic[]): Promise<void> {
  const data: LessonData[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const lessonRepo = dataSource.getRepository(Lesson);
  const sectionRepo = dataSource.getRepository(LessonSection);
  const trackerRepo = dataSource.getRepository(UserLessonTracker);

  const author = await dataSource.getRepository(User).findOne({ where: { role: UserRoleEnum.ADMIN } });
  if (!author) {
    console.warn('  ⚠  No Admin user found — skipping lesson seeding (lesson.userId is required)');
    return;
  }

  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

  let created = 0;
  let replaced = 0;
  let sectionsCreated = 0;

  for (const l of data) {
    const subject = subjectBySlug.get(l.subjectSlug);
    const topic = topicBySlug.get(l.topicSlug);
    if (!subject || !topic) {
      console.warn(`  ⚠  Lesson "${l.slug}": subject "${l.subjectSlug}" or topic "${l.topicSlug}" not found`);
      continue;
    }

    const existing = await lessonRepo.findOne({ where: { slug: l.slug } });
    if (existing) {
      await trackerRepo.delete({ lessonId: existing.id });
      await sectionRepo.delete({ lessonId: existing.id });
      await lessonRepo.delete({ id: existing.id });
      replaced++;
    }

    const lesson = await lessonRepo.save(
      lessonRepo.create({
        title: l.title,
        subjectId: subject.id,
        topicId: topic.id,
        slug: l.slug,
        level: l.level,
        format: l.format ?? 'tutorial',
        tags: l.tags ?? null,
        userId: author.id,
      }),
    );
    created++;

    for (const s of l.sections) {
      const entity = sectionRepo.create({
        lessonId: lesson.id,
        title: s.title,
        description: s.description ?? null,
        blocks: s.blocks ?? null,
      });
      await sectionRepo.save(entity);
      sectionsCreated++;
    }
  }

  console.log(`  ✔ Lessons : ${data.length} declared (${created} created, ${replaced} replaced)`);
  console.log(`  ✔ Sections: ${sectionsCreated} created`);
}
