import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';

const DATA_FILE = path.join(__dirname, '../data/04-questions.seed.json');

interface QuestionData {
  slug: string; title: string | null; question: string; subjectSlug: string;
  questionType: string; level: number; marks: number; timeAllowed: number;
  tag: string | null; status: string; isWhitelisted: boolean; answer: string | null; hint: string | null;
  orderId: number; topicSlugs: string[];
  options: Array<{ option: string; correct: boolean; comment: string | null }>;
}

export async function seedQuestions(dataSource: DataSource, subjects: Subject[], topics: Topic[]): Promise<void> {
  const data: QuestionData[] = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const questionRepo = dataSource.getRepository(Question);
  const optionRepo = dataSource.getRepository(QuestionOption);
  const qTopicRepo = dataSource.getRepository(QuestionTopic);

  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));

  // The "already exists" check below matches by slug, and TypeORM's findOne({ slug: null }) does not
  // filter at all — it returns the first question in the table. So a record without a slug (or with
  // a duplicate one) would be silently skipped. Refuse to seed until every slug is present and unique.
  const missingSlug = data.filter((q) => !q.slug);
  const seen = new Set<string>();
  const duplicateSlugs = data.filter((q) => q.slug && (seen.has(q.slug) || !seen.add(q.slug))).map((q) => q.slug);
  if (missingSlug.length || duplicateSlugs.length) {
    throw new Error(
      `04-questions.seed.json: ${missingSlug.length} question(s) without a slug, ` +
        `${duplicateSlugs.length} duplicate slug(s)${duplicateSlugs.length ? ` (e.g. ${duplicateSlugs.slice(0, 3).join(', ')})` : ''}. ` +
        'Every question needs a unique slug.',
    );
  }

  let created = 0;
  let skipped = 0;
  let optionsCreated = 0;
  let linksCreated = 0;

  for (const q of data) {
    const subject = subjectBySlug.get(q.subjectSlug);
    if (!subject) {
      console.warn(`  ⚠  Question "${q.slug}": subject "${q.subjectSlug}" not found`);
      continue;
    }

    const existing = await questionRepo.findOne({ where: { slug: q.slug } });
    if (existing) {
      skipped++;
      continue;
    }

    const question = await questionRepo.save(
      questionRepo.create({
        slug: q.slug,
        title: q.title,
        question: q.question,
        subjectId: subject.id,
        questionType: q.questionType as QuestionTypeEnum,
        level: q.level,
        marks: q.marks,
        timeAllowed: q.timeAllowed,
        tag: q.tag,
        status: q.status as QuestionStatusEnum,
        isWhitelisted: q.isWhitelisted,
        answer: q.answer,
        hint: q.hint,
        orderId: q.orderId,
      }),
    );
    created++;

    for (const opt of q.options) {
      await optionRepo.save(
        optionRepo.create({
          questionId: question.id,
          option: opt.option,
          correct: opt.correct,
          comment: opt.comment,
        }),
      );
      optionsCreated++;
    }

    for (const topicSlug of q.topicSlugs) {
      const topic = topicBySlug.get(topicSlug);
      if (!topic) continue;
      await qTopicRepo.save(qTopicRepo.create({ questionId: question.id, topicId: topic.id }));
      linksCreated++;
    }
  }

  console.log(`  ✔ Questions   : ${data.length} declared (${created} created, ${skipped} already existed)`);
  console.log(`  ✔ Options     : ${optionsCreated} created`);
  console.log(`  ✔ Topic links : ${linksCreated} created`);
}
