import { AppDataSource } from '../data-source';
import * as fs from 'fs';
import * as path from 'path';
import { EntityManager, In } from 'typeorm';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { SubjectTrackTopic } from 'src/common/typeorm/entities/subject-track-topic.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { TopicLabelEnum } from 'src/common/enum/topic-label.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { minCorrectForCertification, minCorrectForSubjectTrack } from 'src/common/utils/completion-rules';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { LessonSection } from 'src/common/typeorm/entities/lesson-section.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { LessonAccessLevelEnum } from 'src/common/enum/lesson-access-level.enum';
import { sanitizeLessonHtml } from 'src/common/utils/lesson-html-sanitizer.util';

// Scoped, idempotent seed for the Relational Databases curriculum (v2: 4 tracks, 19 topics,
// 3-tier certificate ladder). Unlike the generic seeders, which only create missing rows,
// this one keeps every Relational Databases row in sync with the seed JSON: it renames the
// v1 topics/tracks/certificate in place (ids, question links and bundle-certificate links
// survive), updates every metadata field, syncs track and certificate links exactly, and
// upserts this subject's questions and lessons by slug.
// It deliberately touches nothing outside this subject, so it is safe to re-run at any time:
//   npx ts-node -r tsconfig-paths/register src/database/seeds/seed-relational-databases.ts

const SUBJECT_SLUG = 'relational-databases';
const DATA = path.join(__dirname, 'data');

// v1 → v2 renames, applied before the upserts so existing rows are updated, not duplicated.
const TOPIC_RENAMES: Record<string, string> = {
  'joins-aggregation': 'sql-joins',
  'schema-design-normalization': 'normalization-denormalization',
  'indexes-performance': 'indexes-in-depth',
  'transactions-concurrency': 'concurrency-isolation-locking',
};
const TRACK_RENAMES: Record<string, string> = {
  'relational-db-foundations': 'sql-foundations',
  'relational-db-operations': 'database-performance-production',
};
const CERT_RENAMES: Record<string, string> = {
  'SQL & Relational Databases': 'Relational Database Developer',
};

// The generic programs seed format carries only title/description/content, so the subject
// certificates' slugs live here. Order = ladder order.
const CERT_SLUGS: Record<string, string> = {
  'Relational Database Foundation': 'relational-database-foundation',
  'Relational Database Intermediate': 'relational-database-intermediate',
  'Relational Database Developer': 'relational-database-developer',
};

const readJson = (file: string) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf-8'));

async function syncSubject(m: EntityManager): Promise<Subject> {
  const data = readJson('01-core.seed.json').subjects.find((s: any) => s.slug === SUBJECT_SLUG);
  const subject = await m.findOneByOrFail(Subject, { slug: SUBJECT_SLUG });
  await m.update(Subject, subject.id, { description: data.description, body: data.body });
  return subject;
}

async function applyRenames(m: EntityManager) {
  for (const [from, to] of Object.entries(TOPIC_RENAMES)) {
    if ((await m.countBy(Topic, { slug: from })) && !(await m.countBy(Topic, { slug: to }))) {
      await m.update(Topic, { slug: from }, { slug: to });
      console.log(`  ↻ topic ${from} → ${to}`);
    }
  }
  for (const [from, to] of Object.entries(TRACK_RENAMES)) {
    if ((await m.countBy(SubjectTrack, { slug: from })) && !(await m.countBy(SubjectTrack, { slug: to }))) {
      await m.update(SubjectTrack, { slug: from }, { slug: to });
      console.log(`  ↻ track ${from} → ${to}`);
    }
  }
  for (const [from, to] of Object.entries(CERT_RENAMES)) {
    if ((await m.countBy(CertificationTrack, { title: from })) && !(await m.countBy(CertificationTrack, { title: to }))) {
      await m.update(CertificationTrack, { title: from }, { title: to });
      console.log(`  ↻ certificate "${from}" → "${to}"`);
    }
  }
}

async function syncCurriculum(m: EntityManager, subject: Subject) {
  const data = readJson('02-curriculum.seed.json');
  const topicsData = data.topics.filter((t: any) => t.subjectSlug === SUBJECT_SLUG);
  const tracksData = data.subjectTracks.filter((t: any) => t.subjectSlug === SUBJECT_SLUG);
  let created = 0;
  let updated = 0;

  for (const t of topicsData) {
    const fields = {
      title: t.title, subjectId: subject.id, image: t.image, label: t.label as TopicLabelEnum,
      shortDesc: t.shortDesc, order: t.order, weight: t.weight, popularity: t.popularity,
      isPublished: t.isPublished, description: t.description, goal: t.goal,
    };
    const existing = await m.findOneBy(Topic, { slug: t.slug });
    if (existing) { await m.update(Topic, existing.id, fields); updated++; }
    else { await m.save(m.create(Topic, { slug: t.slug, ...fields })); created++; }
  }
  const extraTopics = await m.find(Topic, { where: { subjectId: subject.id } });
  const declaredTopics = new Set(topicsData.map((t: any) => t.slug));
  for (const t of extraTopics) if (!declaredTopics.has(t.slug)) console.warn(`  ⚠ topic in DB but not in seed JSON: ${t.slug} (t${t.id})`);
  console.log(`  ✔ Topics: ${topicsData.length} declared (${created} created, ${updated} updated)`);

  created = 0; updated = 0;
  for (const tr of tracksData) {
    const fields = { title: tr.title, subjectId: subject.id, description: tr.description, sortOrder: tr.sortOrder, isPublished: tr.isPublished };
    const existing = await m.findOneBy(SubjectTrack, { slug: tr.slug });
    if (existing) { await m.update(SubjectTrack, existing.id, fields); updated++; }
    else { await m.save(m.create(SubjectTrack, { slug: tr.slug, ...fields })); created++; }
  }
  console.log(`  ✔ Subject tracks: ${tracksData.length} declared (${created} created, ${updated} updated)`);

  // Exact link sync for this subject's tracks: add declared links, remove stale ones.
  const topics = await m.find(Topic, { where: { subjectId: subject.id } });
  const tracks = await m.find(SubjectTrack, { where: { subjectId: subject.id } });
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
  const trackBySlug = new Map(tracks.map((t) => [t.slug, t]));
  const declared = new Set<string>();
  for (const l of data.subjectTrackTopics) {
    const track = trackBySlug.get(l.subjectTrackSlug);
    const topic = topicBySlug.get(l.topicSlug);
    if (track && topic) declared.add(`${track.id}:${topic.id}`);
  }
  const existingLinks = await m.find(SubjectTrackTopic, { where: { subjectTrackId: In(tracks.map((t) => t.id)) } });
  const stale = existingLinks.filter((l) => !declared.has(`${l.subjectTrackId}:${l.topicId}`));
  if (stale.length) await m.delete(SubjectTrackTopic, stale.map((l) => l.id));
  const have = new Set(existingLinks.map((l) => `${l.subjectTrackId}:${l.topicId}`));
  let added = 0;
  for (const key of declared) {
    if (have.has(key)) continue;
    const [subjectTrackId, topicId] = key.split(':').map(Number);
    await m.save(m.create(SubjectTrackTopic, { subjectTrackId, topicId }));
    added++;
  }
  console.log(`  ✔ Track-topic links: ${declared.size} declared (${added} added, ${stale.length} removed)`);
}

async function syncCertificates(m: EntityManager, subject: Subject) {
  const data = readJson('03-programs.seed.json');
  const titles = Object.keys(CERT_SLUGS);
  const tracks = await m.find(SubjectTrack, { where: { subjectId: subject.id } });
  const trackBySlug = new Map(tracks.map((t) => [t.slug, t]));

  for (const title of titles) {
    const c = data.certificationTracks.find((x: any) => x.title === title);
    if (!c) throw new Error(`Certificate "${title}" missing from 03-programs.seed.json`);
    const fields = { description: c.description, content: c.content ?? null, slug: CERT_SLUGS[title], subjectId: subject.id, isPublished: true };
    let cert = await m.findOneBy(CertificationTrack, { title });
    if (cert) await m.update(CertificationTrack, cert.id, fields);
    else cert = await m.save(m.create(CertificationTrack, { title, ...fields }));

    const wantTrackIds = new Set<number>(
      data.certificationTrackSubjectTracks
        .filter((l: any) => l.certTrackTitle === title)
        .map((l: any) => {
          const track = trackBySlug.get(l.subjectTrackSlug);
          if (!track) throw new Error(`Certificate "${title}" links unknown track ${l.subjectTrackSlug}`);
          return track.id;
        }),
    );
    const links = await m.find(CertificationTrackSubjectTrack, { where: { certificationTrackId: cert.id } });
    const stale = links.filter((l) => !wantTrackIds.has(l.subjectTrackId));
    if (stale.length) await m.delete(CertificationTrackSubjectTrack, stale.map((l) => l.id));
    const have = new Set(links.map((l) => l.subjectTrackId));
    for (const id of wantTrackIds) if (!have.has(id)) await m.save(m.create(CertificationTrackSubjectTrack, { certificationTrackId: cert.id, subjectTrackId: id }));
    console.log(`  ✔ ${title} (ct${cert.id}) → ${wantTrackIds.size} track(s)`);
  }
}

async function syncQuestions(m: EntityManager, subject: Subject) {
  const all = readJson('04-questions.seed.json').filter((q: any) => q.subjectSlug === SUBJECT_SLUG);
  const topics = await m.find(Topic, { where: { subjectId: subject.id } });
  const topicBySlug = new Map(topics.map((t) => [t.slug, t]));
  let created = 0, updated = 0, optionChanges = 0, linkChanges = 0;

  for (const q of all) {
    const fields = {
      title: q.title, question: q.question, subjectId: subject.id, questionType: q.questionType as QuestionTypeEnum,
      level: q.level, marks: q.marks, timeAllowed: q.timeAllowed, tag: q.tag, status: q.status as QuestionStatusEnum,
      isWhitelisted: q.isWhitelisted, answer: q.answer, hint: q.hint, orderId: q.orderId,
    };
    let row = await m.findOneBy(Question, { slug: q.slug });
    if (row) {
      if (row.subjectId !== subject.id) throw new Error(`Slug ${q.slug} belongs to another subject (q${row.id})`);
      await m.update(Question, row.id, fields);
      updated++;
    } else {
      row = await m.save(m.create(Question, { slug: q.slug, ...fields }));
      created++;
    }

    // Options: update in place when the count matches (keeps option ids stable), else replace.
    const want: any[] = q.options ?? [];
    const have = await m.find(QuestionOption, { where: { questionId: row.id }, order: { id: 'ASC' } });
    if (have.length === want.length) {
      for (let i = 0; i < want.length; i++) {
        const h = have[i], w = want[i];
        if (h.option !== w.option || !!h.correct !== !!w.correct || (h.comment ?? null) !== (w.comment ?? null)) {
          await m.update(QuestionOption, h.id, { option: w.option, correct: w.correct, comment: w.comment ?? null });
          optionChanges++;
        }
      }
    } else {
      if (have.length) await m.delete(QuestionOption, have.map((o) => o.id));
      for (const w of want) await m.save(m.create(QuestionOption, { questionId: row.id, option: w.option, correct: w.correct, comment: w.comment ?? null }));
      optionChanges += want.length;
    }

    // Topic links: exactly the declared topics.
    const wantTopicIds = new Set<number>(q.topicSlugs.map((s: string) => {
      const t = topicBySlug.get(s);
      if (!t) throw new Error(`Question ${q.slug} references unknown topic ${s}`);
      return t.id;
    }));
    const links = await m.find(QuestionTopic, { where: { questionId: row.id } });
    const stale = links.filter((l) => !wantTopicIds.has(l.topicId));
    if (stale.length) { await m.delete(QuestionTopic, stale.map((l) => l.id)); linkChanges += stale.length; }
    const haveIds = new Set(links.map((l) => l.topicId));
    for (const id of wantTopicIds) if (!haveIds.has(id)) { await m.save(m.create(QuestionTopic, { questionId: row.id, topicId: id })); linkChanges++; }
  }

  const strays = await m.query(
    `SELECT id, slug FROM question WHERE subjectId = ? AND (slug IS NULL OR slug NOT IN (?))`,
    [subject.id, all.map((q: any) => q.slug)],
  );
  for (const s of strays) console.warn(`  ⚠ question in DB but not in seed JSON: q${s.id} ${s.slug ?? '(no slug)'}`);
  console.log(`  ✔ Questions: ${all.length} declared (${created} created, ${updated} updated, ${optionChanges} option changes, ${linkChanges} topic-link changes)`);
}

// Same in-place semantics as the generic 05-lesson.seeder: a slug match updates the lesson's
// fields and replaces its sections, but never deletes the Lesson row or touches
// UserLessonTracker, so learner progress survives a reseed. Scoped to this subject, because the
// generic seeder would also rewrite every other subject's lessons from 05-lessons.seed.json.
async function syncLessons(m: EntityManager, subject: Subject) {
  const lessons = readJson('05-lessons.seed.json').filter((l: any) => l.subjectSlug === SUBJECT_SLUG);
  if (!lessons.length) return;
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
      await m.delete(LessonSection, { lessonId: lesson.id });
      updated++;
    } else {
      lesson = await m.save(m.create(Lesson, { slug: l.slug, userId: author.id, ...fields }));
      created++;
    }
    for (const [index, s] of l.sections.entries()) {
      await m.save(m.create(LessonSection, { lessonId: lesson.id, title: s.title, content: sanitizeLessonHtml(s.content), orderIndex: index }));
      sections++;
    }
  }
  console.log(`  ✔ Lessons: ${lessons.length} declared (${created} created, ${updated} updated in place, ${sections} sections)`);
}

async function report(subject: Subject) {
  const rows = await AppDataSource.query(
    `SELECT st.slug track, st.sortOrder, t.order, t.slug topic, t.label,
       (SELECT COUNT(*) FROM question_topic qt JOIN question q ON q.id = qt.questionId
         WHERE qt.topicId = t.id AND q.status = 'Active' AND q.questionType = 'Trivia') activeTrivia
     FROM subject_track st JOIN subject_track_topic stt ON stt.subjectTrackId = st.id JOIN topic t ON t.id = stt.topicId
     WHERE st.subjectId = ? ORDER BY st.sortOrder, t.order`, [subject.id],
  );
  const byTrack = new Map<string, number[]>();
  console.log('\nCurriculum:');
  for (const r of rows) {
    if (!byTrack.has(r.track)) { byTrack.set(r.track, []); console.log(`  ${r.track}`); }
    byTrack.get(r.track).push(Number(r.activeTrivia));
    console.log(`    ${String(r.order).padStart(2)}. ${r.topic.padEnd(36)} ${String(r.label).padEnd(12)} ${r.activeTrivia} Active Trivia`);
  }
  console.log('\nCertificates (fewest correct answers to earn, from current Active Trivia):');
  const certs = await AppDataSource.query(
    `SELECT ct.id, ct.title, ct.passThreshold, GROUP_CONCAT(st.slug ORDER BY st.sortOrder) tracks
     FROM certification_track ct JOIN certification_track_subject_track l ON l.certificationTrackId = ct.id
     JOIN subject_track st ON st.id = l.subjectTrackId WHERE ct.subjectId = ? GROUP BY ct.id ORDER BY COUNT(*)`, [subject.id],
  );
  for (const c of certs) {
    const mins = c.tracks.split(',').map((s: string) => minCorrectForSubjectTrack(byTrack.get(s) ?? []));
    const earn = minCorrectForCertification(mins, c.passThreshold ?? undefined);
    console.log(`  ct${c.id} ${c.title.padEnd(34)} ${c.tracks.split(',').length} track(s)  ${earn ?? 'not yet earnable'}`);
  }
}

async function main() {
  await AppDataSource.initialize();
  try {
    let subject: Subject;
    await AppDataSource.transaction(async (m) => {
      console.log('Subject copy...');
      subject = await syncSubject(m);
      console.log('Renames (v1 → v2)...');
      await applyRenames(m);
      console.log('Topics, tracks and links...');
      await syncCurriculum(m, subject);
      console.log('Certificates...');
      await syncCertificates(m, subject);
      console.log('Questions...');
      await syncQuestions(m, subject);
      console.log('Lessons...');
      await syncLessons(m, subject);
    });
    await report(subject);
    console.log('\nDone.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error('\nSeeding failed (transaction rolled back):', err);
  process.exit(1);
});
