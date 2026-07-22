import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { CertificationTrackSubjectTrack } from './certification-track-subject-track.entity';
import { CertificationTrackJobRole } from './certification-track-job-role.entity';

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
}
