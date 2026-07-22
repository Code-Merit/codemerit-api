import { Column, CreateDateColumn, Entity, OneToMany, UpdateDateColumn } from 'typeorm';
import { ISubject } from '../interface/subject.interface';
import { AbstractEntity } from './abstract.entity';
import { JobRoleSubject } from './job-role-subject.entity';
import { SubjectTrack } from './subject-track.entity';

@Entity()
export class Subject extends AbstractEntity implements ISubject {
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  slug: string;

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
    type: 'text',
    nullable: true,
  })
  scope: string;

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

  @OneToMany(() => JobRoleSubject, (jrs) => jrs.subject)
  jobRoleSubjects: JobRoleSubject[];

  @OneToMany(() => SubjectTrack, (st) => st.subject)
  subjectTracks: SubjectTrack[];
}
