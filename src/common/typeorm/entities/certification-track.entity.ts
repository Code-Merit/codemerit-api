import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { CertificationTrackSubjectTrack } from './certification-track-subject-track.entity';
import { CertificationTrackJobRole } from './certification-track-job-role.entity';
import { Subject } from './subject.entity';

// A canonical certification (e.g. "JavaScript Programmer"). Not tied to a
// single job role — see CertificationTrackJobRole for which roles offer it,
// each with its own sort order and optional role-tailored description.
@Unique(['title'])
@Entity()
export class CertificationTrack extends AbstractEntity {
  @Column({ type: 'varchar', length: 100, nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string;

  // Set when this track is native to a single subject (composed only from that subject's
  // own subject tracks) rather than the job-role-bundle model above — NULL for every
  // pre-existing track. Lets a subject's own dashboard/admin surface query its tracks
  // directly instead of inferring subject membership by joining through subject_track.
  @Column({ type: 'integer', nullable: true, default: null })
  subjectId: number | null;

  // Per-track override of "% of linked subject tracks completed" needed to earn it. NULL
  // falls back to the global CERT_ACHIEVED constant (completion-thresholds.ts) — every
  // existing track keeps behaving exactly as it does today until an admin sets this.
  @Column({ type: 'int', nullable: true, default: null })
  passThreshold: number | null;

  // Today the only publish gate is a CertificationTrackJobRole link's own isPublished flag —
  // a subjectId-native track with no job-role link has no other way to be hidden while in
  // draft, so this is the gate for that case. Job-role-linked tracks keep respecting the
  // per-link flag as before; this defaults true so no existing track is silently hidden.
  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @OneToMany(
    () => CertificationTrackSubjectTrack,
    (ctst) => ctst.certificationTrack,
  )
  certificationTrackSubjectTracks: CertificationTrackSubjectTrack[];

  @OneToMany(() => CertificationTrackJobRole, (ctjr) => ctjr.certificationTrack)
  certificationTrackJobRoles: CertificationTrackJobRole[];

  @ManyToOne(() => Subject, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subjectId' })
  subject?: Subject | null;
}
