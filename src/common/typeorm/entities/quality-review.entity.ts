import { QualityReviewOutcomeEnum } from 'src/common/enum/quality-review-outcome.enum';
import { QualityResourceTypeEnum } from 'src/common/enum/quality-resource-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { QualityReviewTag } from './quality-review-tag.entity';
import { User } from './user.entity';

// One row per SME review PASS — a resource (currently only Question; Lesson is reserved,
// see QualityResourceTypeEnum) can accrue many of these over its life, a full audit trail,
// never a single mutable "current rating" field. Every row here is a FINAL decision: there
// is no draft/in-progress state, so the row is immutable from the moment it's created —
// changing your mind means submitting a new review, not editing this one. Polymorphic
// resourceType/resourceId (rather than one nullable FK column per resource type) follows
// the same pattern already used by UserPermission.resourceType/resourceId; there's no DB-level
// FK on resourceId as a result (can't point at two different tables), so referential
// integrity here is enforced by the service layer, same as UserPermission accepts.
@Index(['resourceType', 'resourceId'])
@Index(['reviewerId'])
@Entity()
export class QualityReview extends AbstractEntity {
  @Column({ type: 'enum', enum: QualityResourceTypeEnum })
  resourceType: QualityResourceTypeEnum;

  @Column({ type: 'int' })
  resourceId: number;

  @Column({ type: 'int', nullable: false })
  reviewerId: number;

  // Reviewer's holistic 1-10 rating. Required by app logic when Approving ("how useful is
  // this"); optional when Rejecting — the attached issue tags already carry that signal.
  @Column({ type: 'int', nullable: true })
  grade: number | null;

  @Column({ type: 'enum', enum: QualityReviewOutcomeEnum, nullable: false })
  outcome: QualityReviewOutcomeEnum;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @OneToMany(() => QualityReviewTag, (tag) => tag.qualityReview)
  tags: QualityReviewTag[];
}
