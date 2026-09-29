import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { JobRoleRelationTypeEnum } from 'src/common/enum/job-role-relation-type.enum';
import { AbstractEntity } from './abstract.entity';
import { JobRole } from './job-role.entity';

// A job role's "extends" edges — jobRoleId inherits relatedJobRoleId's full effective
// scope (subjects + subject tracks), then layers its own JobRoleSubject/JobRoleSubjectTrack
// rows on top. Many-to-many (not a single parentJobRoleId column) so a composite role like
// "Full Stack Developer" can extend more than one parent (e.g. Frontend Engineer AND
// Backend Architect). A child never removes inherited scope, only adds to it — resolution
// is a recursive union, see JobRoleScopeService.resolveEffectiveScope.
@Unique(['jobRoleId', 'relatedJobRoleId'])
@Entity()
export class JobRoleRelation extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  jobRoleId: number;

  @Column({ type: 'integer', nullable: false })
  relatedJobRoleId: number;

  @Column({
    type: 'enum',
    enum: JobRoleRelationTypeEnum,
    default: JobRoleRelationTypeEnum.EXTENDS,
  })
  relationType: JobRoleRelationTypeEnum;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => JobRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleId' })
  jobRole: JobRole;

  @ManyToOne(() => JobRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'relatedJobRoleId' })
  relatedJobRole: JobRole;
}
