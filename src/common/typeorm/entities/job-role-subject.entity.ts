import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { SubjectTagEnum } from 'src/common/enum/subject-tag.enum';
import { TopicLabelEnum } from 'src/common/enum/topic-label.enum';
import { IJobSubject } from '../interface/job-subject.interface';
import { AbstractEntity } from './abstract.entity';
import { JobRole } from './job-role.entity';
import { JobRoleSubjectTrack } from './job-role-subject-track.entity';
import { Subject } from './subject.entity';

@Unique(['jobRoleId', 'subjectId'])
@Entity()
export class JobRoleSubject extends AbstractEntity implements IJobSubject {
  @Column({ type: 'integer', nullable: false })
  jobRoleId: number;

  @Column({ type: 'integer', nullable: false })
  subjectId: number;

  @Column({ type: 'int', nullable: false, default: 1 })
  sortOrder: number;

  @Column({
    type: 'enum',
    enum: SubjectTagEnum,
    default: SubjectTagEnum.MANDATORY,
  })
  tag: SubjectTagEnum;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  note: string;

  // Derived display label — the highest Topic.label among this pairing's effective
  // (inherited + own) SubjectTracks, recomputed whenever JobRoleSubjectTrack rows change.
  // The authoritative scope lives in jobRoleSubjectTracks; this exists purely so a simple
  // "Intermediate" chip can be shown without every consumer walking the track list.
  @Column({
    type: 'enum',
    enum: TopicLabelEnum,
    default: TopicLabelEnum.Foundation,
  })
  requiredLevel: TopicLabelEnum;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => JobRole, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleId', referencedColumnName: 'id' })
  jobRole: JobRole;

  @ManyToOne(() => Subject, (subject) => subject.jobRoleSubjects, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @OneToMany(() => JobRoleSubjectTrack, (jrst) => jrst.jobRoleSubject)
  jobRoleSubjectTracks: JobRoleSubjectTrack[];
}
