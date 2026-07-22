import { Column, CreateDateColumn, Entity, OneToMany, UpdateDateColumn } from 'typeorm';
import { IJobRole } from '../interface/job-role.interface';
import { AbstractEntity } from './abstract.entity';
import { CertificationTrackJobRole } from './certification-track-job-role.entity';
import { JobRoleSubject } from './job-role-subject.entity';

@Entity()
export class JobRole extends AbstractEntity implements IJobRole {
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  body: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  scope: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  slug: string;

  @Column({
    type: 'int',
    nullable: false,
    default: 1
  })
  orderId: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  image: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  color: string;

  @Column({
    type: 'boolean',
    default: true,
  })
  isPublished: boolean;

  @Column({ name: 'createdBy', default: null, select: false })
  createdBy: number;

  @Column({ name: 'updatedBy', default: null, select: false })
  updatedBy: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @OneToMany(() => JobRoleSubject, (jrs) => jrs.jobRole)
  jobRoleSubjects: JobRoleSubject[];

  @OneToMany(() => CertificationTrackJobRole, (ctjr) => ctjr.jobRole)
  certificationTrackJobRoles: CertificationTrackJobRole[];
}
