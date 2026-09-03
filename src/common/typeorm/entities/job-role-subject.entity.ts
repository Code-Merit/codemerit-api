import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { SubjectTagEnum } from 'src/common/enum/subject-tag.enum';
import { IJobSubject } from '../interface/job-subject.interface';
import { AbstractEntity } from './abstract.entity';
import { JobRole } from './job-role.entity';
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

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => JobRole, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleId', referencedColumnName: 'id' })
  jobRole: JobRole;

  @ManyToOne(() => Subject, (subject) => subject.jobRoleSubjects, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;
}
