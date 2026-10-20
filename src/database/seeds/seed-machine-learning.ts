import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { SubjectTrackTopic } from 'src/common/typeorm/entities/subject-track-topic.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { generateSlug, generateUniqueSlug } from 'src/common/utils/slugify.util';
import { DeepPartial } from 'typeorm';
import { AppDataSource } from '../data-source';

const dataDirectory = path.join(__dirname, 'data');
const coreData = JSON.parse(fs.readFileSync(path.join(dataDirectory, '01-core.seed.json'), 'utf8'));
const curriculumData = JSON.parse(fs.readFileSync(path.join(dataDirectory, '02-curriculum.seed.json'), 'utf8'));
const programsData = JSON.parse(fs.readFileSync(path.join(dataDirectory, '03-programs.seed.json'), 'utf8'));

const subjectSlug = 'machine-learning';
const expectedHostnames = new Set(['localhost', '127.0.0.1', '::1']);

async function main(): Promise<void> {
  const configuredHost = process.env.DB_HOST;
  if (!configuredHost || !expectedHostnames.has(configuredHost.toLowerCase())) {
    throw new Error(
      `Refusing to seed: DB_HOST must be localhost, 127.0.0.1, or ::1 (received ${configuredHost || 'unset'}).`,
    );
  }

  const subjectSeed = coreData.subjects.find((subject: any) => subject.slug === subjectSlug);
  if (!subjectSeed) throw new Error(`No ${subjectSlug} subject is present in 01-core.seed.json.`);

  const topics = curriculumData.topics.filter((topic: any) => topic.subjectSlug === subjectSlug);
  const tracks = curriculumData.subjectTracks.filter((track: any) => track.subjectSlug === subjectSlug);
  const topicLinks = curriculumData.subjectTrackTopics.filter((link: any) =>
    link.subjectTrackSlug.startsWith('ml-'),
  );
  const certifications = programsData.certificationTracks.filter(
    (certification: any) => certification.subjectSlug === subjectSlug,
  );
  const certificationTitles = new Set(certifications.map((certification: any) => certification.title));
  const certificationLinks = programsData.certificationTrackSubjectTracks.filter((link: any) =>
    certificationTitles.has(link.certTrackTitle),
  );

  if (topics.length !== 18 || tracks.length !== 5 || certifications.length !== 3) {
    throw new Error('Unexpected ML seed counts; expected 18 topics, 5 tracks, and 3 certifications.');
  }
  const trackSlugs = new Set(tracks.map((track: any) => track.slug));
  const topicSlugs = new Set(topics.map((topic: any) => topic.slug));
  if (
    topicLinks.some((link: any) => !trackSlugs.has(link.subjectTrackSlug) || !topicSlugs.has(link.topicSlug)) ||
    certificationLinks.some((link: any) => !trackSlugs.has(link.subjectTrackSlug))
  ) {
    throw new Error('ML seed contains an unresolved track/topic/certification reference.');
  }

  await AppDataSource.initialize();
  console.log(`Connected to local database "${process.env.DB_DATABASE || '(database name unset)'}".`);

  const result = await AppDataSource.transaction(async (manager) => {
    const subjectRepo = manager.getRepository(Subject);
    const topicRepo = manager.getRepository(Topic);
    const trackRepo = manager.getRepository(SubjectTrack);
    const topicLinkRepo = manager.getRepository(SubjectTrackTopic);
    const certificationRepo = manager.getRepository(CertificationTrack);
    const certificationLinkRepo = manager.getRepository(CertificationTrackSubjectTrack);

    let subject = await subjectRepo.findOne({ where: { slug: subjectSlug } });
    const subjectCreated = !subject;
    if (!subject) {
      subject = subjectRepo.create({ ...subjectSeed } as DeepPartial<Subject>);
    }
    Object.assign(subject, subjectSeed);
    subject = await subjectRepo.save(subject);

    const topicBySlug = new Map<string, Topic>();
    let topicsCreated = 0;
    for (const seed of topics) {
      let topic = await topicRepo.findOne({ where: { slug: seed.slug } });
      const isNew = !topic;
      topic = topic ?? topicRepo.create();
      Object.assign(topic, {
        slug: seed.slug,
        title: seed.title,
        subjectId: subject.id,
        image: seed.image,
        label: seed.label,
        shortDesc: seed.shortDesc,
        order: seed.order,
        weight: seed.weight,
        popularity: seed.popularity,
        isPublished: seed.isPublished,
        description: seed.description,
        goal: seed.goal,
      });
      const saved = await topicRepo.save(topic);
      topicBySlug.set(seed.slug, saved);
      if (isNew) topicsCreated++;
    }

    const trackBySlug = new Map<string, SubjectTrack>();
    let tracksCreated = 0;
    for (const seed of tracks) {
      let track = await trackRepo.findOne({ where: { slug: seed.slug } });
      const isNew = !track;
      track = track ?? trackRepo.create();
      Object.assign(track, {
        slug: seed.slug,
        title: seed.title,
        subjectId: subject.id,
        description: seed.description,
        sortOrder: seed.sortOrder,
        isPublished: seed.isPublished,
      });
      const saved = await trackRepo.save(track);
      trackBySlug.set(seed.slug, saved);
      if (isNew) tracksCreated++;
    }

    let topicLinksCreated = 0;
    for (const link of topicLinks) {
      const track = trackBySlug.get(link.subjectTrackSlug);
      const topic = topicBySlug.get(link.topicSlug);
      if (!track || !topic) throw new Error(`Unresolved ML topic mapping: ${link.subjectTrackSlug} → ${link.topicSlug}`);
      const exists = await topicLinkRepo.findOne({
        where: { subjectTrackId: track.id, topicId: topic.id },
      });
      if (!exists) {
        await topicLinkRepo.save(topicLinkRepo.create({ subjectTrackId: track.id, topicId: topic.id }));
        topicLinksCreated++;
      }
    }

    const certificationByTitle = new Map<string, CertificationTrack>();
    let certificationsCreated = 0;
    for (const seed of certifications) {
      let certification = await certificationRepo.findOne({ where: { title: seed.title } });
      const isNew = !certification;
      if (!certification) {
        let slug = generateSlug(seed.slug ?? seed.title, 140);
        while (!slug || await certificationRepo.findOne({ where: { slug } })) {
          slug = generateUniqueSlug(seed.title, 140, 6);
        }
        certification = certificationRepo.create({
          title: seed.title,
          slug,
          content: seed.content ?? null,
        });
      } else if (!certification.content && seed.content) {
        certification.content = seed.content;
      }

      Object.assign(certification, {
        description: seed.description,
        subjectId: subject.id,
        passThreshold: seed.passThreshold ?? null,
        isPublished: seed.isPublished ?? true,
      });
      const saved = await certificationRepo.save(certification);
      certificationByTitle.set(seed.title, saved);
      if (isNew) certificationsCreated++;
    }

    let certificationLinksCreated = 0;
    for (const link of certificationLinks) {
      const certification = certificationByTitle.get(link.certTrackTitle);
      const track = trackBySlug.get(link.subjectTrackSlug);
      if (!certification || !track) {
        throw new Error(`Unresolved ML certification mapping: ${link.certTrackTitle} → ${link.subjectTrackSlug}`);
      }
      const exists = await certificationLinkRepo.findOne({
        where: { certificationTrackId: certification.id, subjectTrackId: track.id },
      });
      if (!exists) {
        await certificationLinkRepo.save(
          certificationLinkRepo.create({ certificationTrackId: certification.id, subjectTrackId: track.id }),
        );
        certificationLinksCreated++;
      }
    }

    return {
      subjectCreated,
      topicsCreated,
      topicsProcessed: topics.length,
      tracksCreated,
      tracksProcessed: tracks.length,
      topicLinksCreated,
      topicLinksProcessed: topicLinks.length,
      certificationsCreated,
      certificationsProcessed: certifications.length,
      certificationLinksCreated,
      certificationLinksProcessed: certificationLinks.length,
    };
  });

  console.log('Machine Learning curriculum seeded successfully:');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('Machine Learning seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });