import { AppDataSource } from '../data-source';
import * as fs from 'fs';
import * as path from 'path';
import { In } from 'typeorm';
import { seedCore } from './seeders/01-core.seeder';
import { seedCurriculum } from './seeders/02-curriculum.seeder';
import { seedPrograms } from './seeders/03-programs.seeder';
import { seedBadges } from './seeders/06-badges.seeder';
import { seedLessons } from './seeders/05-lesson.seeder';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { LessonSection } from 'src/common/typeorm/entities/lesson-section.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { BadgeRule } from 'src/common/typeorm/entities/badge-rule.entity';

// Scoped seed run for the AI Fundamentals subject only.
//
// Runs the real (idempotent, slug-deduped) seedCore + seedCurriculum against the
// full 01-core/02-curriculum seed files — safe because neither file has any
// null-slug rows. Deliberately does NOT run the full question seeder against
// 04-questions.seed.json: 3305 of its existing rows currently have slug: null
// (an unrelated in-progress cleanup pass), and the seeder's findOne({where:{slug:null}})
// dedup check would match the same first null-slug DB row for all of them,
// inserting one bogus row and silently skipping the rest. Instead this filters
// 04-questions.seed.json down to just subjectSlug "ai-fundamentals" (136 rows,
// all unique non-null slugs) and inserts only those, leaving the other 5546
// pre-existing rows untouched.

async function main() {
  await AppDataSource.initialize();
  console.log('Database connected.\n');

  try {
    console.log('Seeding core (job roles, subjects)...');
    const { jobRoles, subjects } = await seedCore(AppDataSource);

    console.log('\nSeeding curriculum (topics, subject tracks)...');
    const { topics, subjectTracks } = await seedCurriculum(AppDataSource, subjects);

    const subject = subjects.find((s) => s.slug === 'ai-fundamentals');
    if (!subject) {
      throw new Error('Subject "ai-fundamentals" not found after seedCore — cannot proceed.');
    }
    console.log(`\nSubject confirmed: ai-fundamentals (id ${subject.id})`);

    const myTopics = topics.filter((t) => t.subjectId === subject.id);
    console.log(`Topics for ai-fundamentals: ${myTopics.length} records`);
    const topicBySlug = new Map(myTopics.map((t) => [t.slug, t]));

    console.log('\nSeeding AI Fundamentals questions (filtered from 04-questions.seed.json)...');
    const questionsFile = path.join(__dirname, 'data/04-questions.seed.json');
    const allQuestions: any[] = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
    const myQuestions = allQuestions.filter((q) => q.subjectSlug === 'ai-fundamentals');
    console.log(`Questions declared for ai-fundamentals: ${myQuestions.length}`);

    const questionRepo = AppDataSource.getRepository(Question);
    const optionRepo = AppDataSource.getRepository(QuestionOption);
    const qTopicRepo = AppDataSource.getRepository(QuestionTopic);

    let created = 0;
    let skipped = 0;
    let optionsCreated = 0;
    let linksCreated = 0;
    const missingTopicLinks: string[] = [];

    for (const q of myQuestions) {
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
        if (!topic) {
          missingTopicLinks.push(`${q.slug} -> ${topicSlug}`);
          continue;
        }
        await qTopicRepo.save(qTopicRepo.create({ questionId: question.id, topicId: topic.id }));
        linksCreated++;
      }
    }

    console.log(`\n✔ Questions   : ${myQuestions.length} declared (${created} created, ${skipped} already existed)`);
    console.log(`✔ Options     : ${optionsCreated} created`);
    console.log(`✔ Topic links : ${linksCreated} created`);
    if (missingTopicLinks.length) {
      console.log(`⚠ Missing topic links (${missingTopicLinks.length}):`);
      for (const m of missingTopicLinks) console.log(`   - ${m}`);
    } else {
      console.log('✔ No missing topic links — every question resolved to its topic.');
    }

    // Gap check: every one of the 13 topics should now have at least one linked question.
    const allLinks = await qTopicRepo.find({ where: { topicId: In(myTopics.map((t) => t.id)) } });
    const linkCountByTopicId = new Map<number, number>();
    for (const l of allLinks) linkCountByTopicId.set(l.topicId, (linkCountByTopicId.get(l.topicId) ?? 0) + 1);
    console.log('\nPer-topic linked question counts:');
    let anyGap = false;
    for (const t of myTopics.sort((a, b) => a.order - b.order)) {
      const count = linkCountByTopicId.get(t.id) ?? 0;
      if (count === 0) anyGap = true;
      console.log(`   ${String(t.order).padStart(2, '0')}. ${t.slug.padEnd(32)} ${count}`);
    }
    console.log(anyGap ? '\n⚠ GAP: at least one topic has zero linked questions.' : '\n✔ No gaps — every topic has at least one linked question.');

    console.log('\nSeeding programs (job-role subjects, certification tracks)...');
    await seedPrograms(AppDataSource, jobRoles, subjects, subjectTracks);

    console.log('\nSeeding badges...');
    await seedBadges(AppDataSource);

    // Verify the AI Fundamentals certification ladder and badges landed correctly.
    const myTrackSlugs = ['ai-foundations', 'applied-ai-and-llms', 'ai-judgment-and-responsibility'];
    const myCertTitles = ['AI Foundation', 'AI Intermediate', 'AI Fundamentals Certified'];
    const ctRepo = AppDataSource.getRepository(CertificationTrack);
    const ctstRepo = AppDataSource.getRepository(CertificationTrackSubjectTrack);
    const myCerts = await ctRepo.find({ where: { title: In(myCertTitles) } });
    console.log(`\nCertification tracks created: ${myCerts.length} of ${myCertTitles.length}`);
    for (const c of myCerts) {
      const links = await ctstRepo.find({ where: { certificationTrackId: c.id } });
      console.log(`   ${c.title.padEnd(28)} -> ${links.length} subject track(s) linked`);
    }
    const myTracks = subjectTracks.filter((t) => myTrackSlugs.includes(t.slug));
    if (myTracks.length !== 3) {
      console.log(`⚠ GAP: expected 3 AI Fundamentals subject tracks, found ${myTracks.length}`);
    }

    const badgeRepo = AppDataSource.getRepository(Badge);
    const badgeRuleRepo = AppDataSource.getRepository(BadgeRule);
    const myBadgeCodes = [
      'ai_fundamentals_beginner',
      'ai_fundamentals_expert',
      'ai_fundamentals_llm_specialist',
      'ai_fundamentals_prompt_specialist',
    ];
    const myBadges = await badgeRepo.find({ where: { code: In(myBadgeCodes) } });
    console.log(`\nBadges created: ${myBadges.length} of ${myBadgeCodes.length}`);
    for (const b of myBadges) {
      const rule = await badgeRuleRepo.findOne({ where: { badgeId: b.id } });
      console.log(`   ${b.code.padEnd(34)} rule=${rule ? `${rule.metric}>=${rule.threshold}${rule.difficultyLevel ? ` (${rule.difficultyLevel})` : ''}` : 'MISSING'}`);
    }

    console.log('\nSeeding lessons (full run — 05-lessons.seed.json has no null-slug rows, verified safe)...');
    await seedLessons(AppDataSource, subjects, topics);

    const lessonRepo = AppDataSource.getRepository(Lesson);
    const myLessonTopicSlugs = [
      ...myTopics.map((t) => t.slug),
      'introduction-to-html', 'html-document-structure', 'text-and-formatting-elements',
      'links-and-navigation', 'lists-and-tables', 'images-and-multimedia',
      'forms-and-input-elements', 'semantic-html', 'forms-validation-and-attributes',
      'embedding-content-iframes-external-me', 'metadata-and-seo-basics', 'accessibility-in-html',
    ];
    const htmlSubject = subjects.find((s) => s.slug === 'html');
    const htmlTopics = htmlSubject ? topics.filter((t) => t.subjectId === htmlSubject.id) : [];
    const allMyTopics = [...myTopics, ...htmlTopics].filter((t) => myLessonTopicSlugs.includes(t.slug));
    console.log(`\nExpecting lessons for ${allMyTopics.length} topics (13 AI Fundamentals + 12 HTML)`);

    let lessonGap = false;
    for (const t of allMyTopics) {
      const lesson = await lessonRepo.findOne({ where: { topicId: t.id } });
      const sections = lesson ? await AppDataSource.getRepository(LessonSection).count({ where: { lessonId: lesson.id } }) : 0;
      if (!lesson || sections === 0) lessonGap = true;
      console.log(`   ${t.slug.padEnd(38)} lesson=${lesson ? 'yes' : 'NO'} sections=${sections}`);
    }
    console.log(lessonGap ? '\n⚠ GAP: at least one topic has no lesson or zero sections.' : '\n✔ No gaps — every one of the 25 topics has a lesson with sections.');

    console.log('\nDone.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('\nSeeding failed:', err);
  process.exit(1);
});
