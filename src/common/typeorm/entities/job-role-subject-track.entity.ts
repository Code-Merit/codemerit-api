import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { JobRoleSubject } from './job-role-subject.entity';
import { SubjectTrack } from './subject-track.entity';

// Precisely which SubjectTrack(s) a JobRoleSubject pairing covers — the same tiering
// mechanism CertificationTrackSubjectTrack already uses to compose cert tiers, so a job
// role's declared scope for a subject and a cert track's scope are directly comparable.
// This is the row-level detail behind JobRoleSubject.requiredLevel (which is just a
// derived display label — see job-role-subject.entity.ts).
@Unique(['jobRoleSubjectId', 'subjectTrackId'])
@Entity()
export class JobRoleSubjectTrack extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  jobRoleSubjectId: number;

  @Column({ type: 'integer', nullable: false })
  subjectTrackId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => JobRoleSubject, (jrs) => jrs.jobRoleSubjectTracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleSubjectId' })
  jobRoleSubject: JobRoleSubject;

  @ManyToOne(() => SubjectTrack, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectTrackId' })
  subjectTrack: SubjectTrack;
}
