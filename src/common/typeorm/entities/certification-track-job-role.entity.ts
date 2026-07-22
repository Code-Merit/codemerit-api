import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { CertificationTrack } from './certification-track.entity';
import { JobRole } from './job-role.entity';

// Associates one canonical CertificationTrack with a job role. A single
// certification (e.g. "JavaScript Programmer") can be earned via multiple
// job-role learning paths without being duplicated as separate rows — each
// association carries its own display order and an optional role-tailored
// description that overrides the certification's default text.
@Unique(['certificationTrackId', 'jobRoleId'])
@Entity()
export class CertificationTrackJobRole extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  certificationTrackId: number;

  @Column({ type: 'integer', nullable: false })
  jobRoleId: number;

  @Column({ type: 'int', nullable: false, default: 1 })
  sortOrder: number;

  @Column({ type: 'text', nullable: true, default: null })
  descriptionOverride: string;

  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => CertificationTrack, (ct) => ct.certificationTrackJobRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificationTrackId' })
  certificationTrack: CertificationTrack;

  @ManyToOne(() => JobRole, (jobRole) => jobRole.certificationTrackJobRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleId' })
  jobRole: JobRole;
}
