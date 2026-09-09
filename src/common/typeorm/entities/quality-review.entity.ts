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
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { QualityReviewTag } from './quality-review-tag.entity';
import { User } from './user.entity';

// One row per (resource, reviewer) pair — a resource (currently only Question; Lesson is
// reserved, see QualityResourceTypeEnum) can be reviewed by many SMEs, but the SAME reviewer
// reviewing the SAME resource again updates this row in place rather than creating a second
// one (enforced by the unique index below). The audit trail lives inside `comment`, which is
// an append-only, dated changelog: every submit appends a summary of what changed (or a
// snapshot, on first submission) without ever erasing what was there before — see
// QuestionQualityService.submitReview/buildChangelogEntry. `grade`/`outcome`/tags always
// reflect only the latest submission. Polymorphic resourceType/resourceId (rather than one
// nullable FK column per resource type) follows the same pattern already used by
// UserPermission.resourceType/resourceId; there's no DB-level FK on resourceId as a result
// (can't point at two different tables), so referential integrity here is enforced by the
// service layer, same as UserPermission accepts.
@Index(['resourceType', 'resourceId'])
@Index(['reviewerId'])
@Index('IDX_quality_review_resourceType_resourceId_reviewerId', ['resourceType', 'resourceId', 'reviewerId'], {
  unique: true,
})
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

  // Set to the same instant as createdAt on insert (MySQL's ON UPDATE CURRENT_TIMESTAMP also
  // fires on the initial INSERT), then bumped on every subsequent edit — this is the ordering
  // key "latest review for this resource" queries use now that a row can be updated, not just
  // inserted (a bare MAX(id) would pick the wrong row once an older row can become the most
  // recently touched one).
  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @OneToMany(() => QualityReviewTag, (tag) => tag.qualityReview)
  tags: QualityReviewTag[];
}
