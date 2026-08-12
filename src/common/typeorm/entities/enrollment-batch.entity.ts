import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';
import { EnrollmentSourceEnum } from 'src/common/enum/enrollment-source.enum';
import { EnrollmentBatchStatusEnum } from 'src/common/enum/enrollment-batch-status.enum';

// Header row for one multi-subject enrollment action (free or paid) — "enroll me in
// this job role's subjects, all of them or the ones I picked, at this plan," in one
// user action. SkillEnrollment stays subject-only and knows nothing about batching
// beyond its own optional batchId FK; this entity is purely a grouping/provenance
// record, never an access concept — a subject's real access is always decided by its
// own SkillEnrollment row, regardless of whether that row has a batchId or not.
@Index('IDX_enrollment_batch_userId', ['userId'])
@Entity()
export class EnrollmentBatch extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  userId: number;

  // Which job role's subject list this selection was made from, if any — opaque
  // provenance for display/analytics only ("you enrolled via Backend Developer").
  // Never server-verified against JobRoleSubject and never used to gate access.
  @Column({ type: 'integer', nullable: true, default: null })
  jobRoleId: number | null;

  // One plan for the whole batch — no mixed-tier selections in one action.
  @Column({ type: 'enum', enum: EnrollmentTierEnum, nullable: false })
  tier: EnrollmentTierEnum;

  @Column({
    type: 'enum',
    enum: EnrollmentBatchStatusEnum,
    default: EnrollmentBatchStatusEnum.Pending,
  })
  status: EnrollmentBatchStatusEnum;

  @Column({ type: 'enum', enum: EnrollmentSourceEnum, nullable: false })
  source: EnrollmentSourceEnum;

  // Sum of each eligible subject's own price at `tier` — null for a free (basic)
  // batch. Flat pricing, no bundle discount.
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: null })
  totalAmount: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  currency: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true, default: null })
  completedAt: Date | null;
}
