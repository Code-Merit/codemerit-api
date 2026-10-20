import { AppDataSource } from '../data-source';
import * as fs from 'fs';
import * as path from 'path';
import { In } from 'typeorm';
import { seedCore } from './seeders/01-core.seeder';
import { seedCurriculum } from './seeders/02-curriculum.seeder';
import { seedPrograms } from './seeders/03-programs.seeder';
import { seedBadges } from './seeders/06-badges.seeder';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { BadgeRule } from 'src/common/typeorm/entities/badge-rule.entity';

// Scoped seed run for the new "Node.js Real-Time & WebSockets" track only (4 new
// topics under the existing `nodejs` subject: websocket-protocol-fundamentals,
// socketio-realtime-servers, realtime-architecture-patterns, scaling-securing-websockets).
//
// Mirrors seed-ai-fundamentals.ts's pattern exactly: runs the real, idempotent
// seedCore/seedCurriculum/seedPrograms/seedBadges against their full seed files (safe —
// none of the new rows added for this track collide with anything pre-existing), but
// deliberately does NOT run the full question seeder against 04-questions.seed.json.
// As of this writing codemerit-api's DB still has a large number of pre-existing
// Question rows with slug: null (an unrelated in-progress cleanup pass), which would
// break the real seeder's findOne({ where: { slug } }) dedup if a JSON entry ever had a
// null/empty slug. All of this track's questions have unique, non-null slugs, so this
// filters 04-questions.seed.json down to just the 4 new topic slugs and inserts only
// those, leaving every other pre-existing row untouched.

const TRACK_TOPIC_SLUGS = [
  'websocket-protocol-fundamentals',
  'socketio-realtime-servers',
  'realtime-architecture-patterns',
  'scaling-securing-websockets',
];

async function main() {
  await AppDataSource.initialize();
  console.log('Database connected.\n');

  try {
    console.log('Seeding core (job roles, subjects)...');
    const { jobRoles, subjects } = await seedCore(AppDataSource);

    console.log('\nSeeding curriculum (topics, subject tracks)...');
    const { topics, subjectTracks } = await seedCurriculum(AppDataSource, subjects);

    const subject = subjects.find((s) => s.slug === 'nodejs');
    if (!subject) {
      throw new Error('Subject "nodejs" not found after seedCore — cannot proceed.');
    }
    console.log(`\nSubject confirmed: nodejs (id ${subject.id})`);

    const myTopics = topics.filter((t) => TRACK_TOPIC_SLUGS.includes(t.slug));
    console.log(`New real-time topics found: ${myTopics.length} of ${TRACK_TOPIC_SLUGS.length} declared`);
    const topicBySlug = new Map(myTopics.map((t) => [t.slug, t]));

    console.log('\nSeeding real-time questions (filtered from 04-questions.seed.json)...');
    const questionsFile = path.join(__dirname, 'data/04-questions.seed.json');
    const allQuestions: any[] = JSON.parse(fs.readFileSync(questionsFile, 'utf-8'));
    const myQuestions = allQuestions.filter(
      (q) => q.subjectSlug === 'nodejs' && q.topicSlugs?.some((s: string) => TRACK_TOPIC_SLUGS.includes(s)),
    );
    console.log(`Questions declared for the real-time track: ${myQuestions.length}`);

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

      for (const opt of q.options ?? []) {
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

    // Gap check: every one of the 4 new topics should now have at least one linked question.
    const allLinks = await qTopicRepo.find({ where: { topicId: In(myTopics.map((t) => t.id)) } });
    const linkCountByTopicId = new Map<number, number>();
    for (const l of allLinks) linkCountByTopicId.set(l.topicId, (linkCountByTopicId.get(l.topicId) ?? 0) + 1);
    console.log('\nPer-topic linked question counts:');
    let anyGap = false;
    for (const t of myTopics.sort((a, b) => a.order - b.order)) {
      const count = linkCountByTopicId.get(t.id) ?? 0;
      if (count === 0) anyGap = true;
      console.log(`   ${t.slug.padEnd(36)} ${count}`);
    }
    console.log(anyGap ? '\n⚠ GAP: at least one topic has zero linked questions.' : '\n✔ No gaps — every topic has at least one linked question.');

    console.log('\nSeeding programs (job-role subjects, certification tracks)...');
    await seedPrograms(AppDataSource, jobRoles, subjects, subjectTracks);

    console.log('\nSeeding badges...');
    await seedBadges(AppDataSource);

    // Verify the new subject track + certification additions landed correctly.
    const myTrack = subjectTracks.find((t) => t.slug === 'nodejs-realtime');
    if (!myTrack) {
      console.log('\n⚠ GAP: expected subject track "nodejs-realtime" not found.');
    } else {
      console.log(`\nSubject track confirmed: nodejs-realtime (id ${myTrack.id})`);
    }

    const myCertTitles = ['Real-Time & WebSocket Developer', 'Backend JavaScript Expert'];
    const ctRepo = AppDataSource.getRepository(CertificationTrack);
    const ctstRepo = AppDataSource.getRepository(CertificationTrackSubjectTrack);
    const myCerts = await ctRepo.find({ where: { title: In(myCertTitles) } });
    console.log(`\nCertification tracks checked: ${myCerts.length} of ${myCertTitles.length} found`);
    for (const c of myCerts) {
      const links = await ctstRepo.find({ where: { certificationTrackId: c.id } });
      const hasRealtimeLink = myTrack ? links.some((l) => l.subjectTrackId === myTrack.id) : false;
      console.log(`   ${c.title.padEnd(34)} -> ${links.length} subject track(s) linked total, includes nodejs-realtime: ${hasRealtimeLink}`);
    }

    const badgeRepo = AppDataSource.getRepository(Badge);
    const badgeRuleRepo = AppDataSource.getRepository(BadgeRule);
    const myBadgeCodes = ['nodejs_realtime_specialist'];
    const myBadges = await badgeRepo.find({ where: { code: In(myBadgeCodes) } });
    console.log(`\nBadges created: ${myBadges.length} of ${myBadgeCodes.length}`);
    for (const b of myBadges) {
      const rule = await badgeRuleRepo.findOne({ where: { badgeId: b.id } });
      console.log(`   ${b.code.padEnd(34)} rule=${rule ? `${rule.metric}>=${rule.threshold}${rule.difficultyLevel ? ` (${rule.difficultyLevel})` : ''}` : 'MISSING'}`);
    }

    console.log('\nDone.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('\nSeeding failed:', err);
  process.exit(1);
});
