import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackJobRole } from 'src/common/typeorm/entities/certification-track-job-role.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { SubjectTagEnum } from 'src/common/enum/subject-tag.enum';
import { generateSlug, generateUniqueSlug } from 'src/common/utils/slugify.util';

const DATA_FILE = path.join(__dirname, '../data/03-programs.seed.json');

interface ProgramsData {
  jobRoleSubjects: Array<{
    jobRoleSlug: string; subjectSlug: string; sortOrder: number; tag: string; note: string | null;
  }>;
  certificationTracks: Array<{
    title: string; slug?: string; description: string | null; content?: string | null;
    subjectSlug?: string | null; passThreshold?: number | null; isPublished?: boolean;
  }>;
  certificationTrackJobRoles: Array<{
    certTrackTitle: string; jobRoleSlug: string; sortOrder: number; isPublished: boolean;
    descriptionOverride: string | null;
  }>;
  certificationTrackSubjectTracks: Array<{
    certTrackTitle: string; subjectTrackSlug: string;
  }>;
}

export async function seedPrograms(
  dataSource: DataSource,
  jobRoles: JobRole[],
  subjects: Subject[],
  subjectTracks: SubjectTrack[],
): Promise<void> {
  const data: ProgramsData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const jrsRepo = dataSource.getRepository(JobRoleSubject);
  const ctRepo = dataSource.getRepository(CertificationTrack);
  const ctJobRoleRepo = dataSource.getRepository(CertificationTrackJobRole);
  const ctstRepo = dataSource.getRepository(CertificationTrackSubjectTrack);

  const jobRoleBySlug = new Map(jobRoles.map((j) => [j.slug, j]));
  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  const trackBySlug = new Map(subjectTracks.map((t) => [t.slug, t]));

  let jrsCreated = 0;
  let jrsUpdated = 0;
  for (const j of data.jobRoleSubjects) {
    const jobRole = jobRoleBySlug.get(j.jobRoleSlug);
    const subject = subjectBySlug.get(j.subjectSlug);
    if (!jobRole || !subject) continue;
    const exists = await jrsRepo.findOne({ where: { jobRoleId: jobRole.id, subjectId: subject.id } });
    if (!exists) {
      await jrsRepo.save(
        jrsRepo.create({
          jobRoleId: jobRole.id,
          subjectId: subject.id,
          sortOrder: j.sortOrder,
          tag: j.tag as SubjectTagEnum,
          note: j.note,
        }),
      );
      jrsCreated++;
    } else if (exists.tag !== j.tag || exists.sortOrder !== j.sortOrder) {
      await jrsRepo.save({ ...exists, tag: j.tag as SubjectTagEnum, sortOrder: j.sortOrder, note: j.note });
      jrsUpdated++;
    }
  }

  let ctCreated = 0;
  let ctContentBackfilled = 0;
  for (const c of data.certificationTracks) {
    const exists = await ctRepo.findOne({ where: { title: c.title } });
    if (!exists) {
      const subject = c.subjectSlug ? subjectBySlug.get(c.subjectSlug) : null;
      if (c.subjectSlug && !subject) {
        console.warn(`  ⚠  Certification "${c.title}": subject "${c.subjectSlug}" not found`);
        continue;
      }

      let slug = generateSlug(c.slug ?? c.title, 140);
      while (!slug || await ctRepo.findOne({ where: { slug } })) {
        slug = generateUniqueSlug(c.title, 140, 6);
      }

      await ctRepo.save(ctRepo.create({
        title: c.title,
        slug,
        description: c.description,
        content: c.content ?? null,
        subjectId: subject?.id ?? null,
        passThreshold: c.passThreshold ?? null,
        isPublished: c.isPublished ?? true,
      }));
      ctCreated++;
    } else if (!exists.content && c.content) {
      // Backfill only — never overwrite content an admin may have already crafted for this track.
      await ctRepo.save({ ...exists, content: c.content });
      ctContentBackfilled++;
    }
  }

  const certTracks = await ctRepo.find();
  const certTrackByTitle = new Map(certTracks.map((c) => [c.title, c]));

  let ctJobRoleCreated = 0;
  for (const l of data.certificationTrackJobRoles) {
    const jobRole = jobRoleBySlug.get(l.jobRoleSlug);
    const certTrack = certTrackByTitle.get(l.certTrackTitle);
    if (!jobRole || !certTrack) continue;
    const exists = await ctJobRoleRepo.findOne({
      where: { certificationTrackId: certTrack.id, jobRoleId: jobRole.id },
    });
    if (!exists) {
      await ctJobRoleRepo.save(
        ctJobRoleRepo.create({
          certificationTrackId: certTrack.id,
          jobRoleId: jobRole.id,
          sortOrder: l.sortOrder,
          isPublished: l.isPublished,
          descriptionOverride: l.descriptionOverride,
        }),
      );
      ctJobRoleCreated++;
    }
  }

  let linksCreated = 0;
  for (const l of data.certificationTrackSubjectTracks) {
    const track = trackBySlug.get(l.subjectTrackSlug);
    const certTrack = certTrackByTitle.get(l.certTrackTitle);
    if (!track || !certTrack) continue;
    const exists = await ctstRepo.findOne({
      where: { certificationTrackId: certTrack.id, subjectTrackId: track.id },
    });
    if (!exists) {
      await ctstRepo.save(ctstRepo.create({ certificationTrackId: certTrack.id, subjectTrackId: track.id }));
      linksCreated++;
    }
  }

  console.log(`  ✔ Job-role subjects        : ${data.jobRoleSubjects.length} declared (${jrsCreated} created, ${jrsUpdated} updated)`);
  console.log(`  ✔ Certification tracks     : ${certTracks.length} records (${ctCreated} created, ${ctContentBackfilled} content backfilled)`);
  console.log(`  ✔ Cert-track-job-role links: ${data.certificationTrackJobRoles.length} declared (${ctJobRoleCreated} created)`);
  console.log(`  ✔ Cert-track-subject links : ${data.certificationTrackSubjectTracks.length} declared (${linksCreated} created)`);
}
