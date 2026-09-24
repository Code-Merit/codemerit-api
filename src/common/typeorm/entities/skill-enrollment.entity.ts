import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';
import { EnrollmentStatusEnum } from 'src/common/enum/enrollment-status.enum';
import { EnrollmentSourceEnum } from 'src/common/enum/enrollment-source.enum';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

// Sole source of truth for a user's relationship to a subject — both real paid/tiered
// access (Curious+) and free Basic (self-serve, explicit, never implicit — see
// SkillEnrollmentService.enrollBasic()). Subject-only by design: a JobRole is just a
// grouping of subjects (JobRoleSubject), not a separate enrollable scope — "enrolling
// in a job role" means enrolling in one or more of its subjects individually, and
// "which job roles is a user pursuing" is a derived read, never stored here.
// Distinct from UserJobRole, which stays as a separate concept — a free, many-to-many
// career-path *target* declaration (aspirational, no access implication), not a
// follow/access relationship. UserSubject (the old free "follow" table this entity
// replaced) is gone entirely — an active SkillEnrollment row (any tier, including
// Basic) is now the one signal for "this user is engaged with this subject."
@Index('IDX_skill_enrollment_userId_subjectId', ['userId', 'subjectId'])
@Entity()
export class SkillEnrollment extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  userId: number;

  @Column({ type: 'integer', nullable: false })
  subjectId: number;

  // Set when this row was created as part of a multi-subject enrollment action (see
  // EnrollmentBatch) — purely a grouping/provenance link, never consulted for access.
  // Null for anything created outside a batch flow (e.g. a single admin grant).
  @Column({ type: 'integer', nullable: true, default: null })
  batchId: number | null;

  // Every tier is persisted, Basic included — there is no implicit default. No active
  // row for (userId, subjectId) means "not enrolled at all" (tier: null at the
  // service layer), not Basic.
  @Column({ type: 'enum', enum: EnrollmentTierEnum, nullable: false })
  tier: EnrollmentTierEnum;

  @Column({
    type: 'enum',
    enum: EnrollmentStatusEnum,
    default: EnrollmentStatusEnum.Active,
  })
  status: EnrollmentStatusEnum;

  @Column({
    type: 'enum',
    enum: EnrollmentSourceEnum,
    default: EnrollmentSourceEnum.AdminGrant,
  })
  source: EnrollmentSourceEnum;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: null })
  price: number | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  currency: string | null;

  // Free-form reference to whatever created this (order id, promo code, admin note)
  // — not a foreign key, since Purchase isn't wired to a real Order entity yet.
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  reference: string | null;

  @Column({ type: 'datetime', nullable: false, default: () => 'CURRENT_TIMESTAMP' })
  startAt: Date;

  // Time-boxed by design (locked decision: no lifetime access) — nullable only to
  // allow a future permanent/comp grant without a schema change, not used today.
  @Column({ type: 'datetime', nullable: true, default: null })
  expiresAt: Date | null;

  @Column({ type: 'integer', nullable: true, default: null })
  grantedBy: number | null;

  @Column({ type: 'text', nullable: true, default: null })
  note: string | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  cancelledAt: Date | null;

  @Column({ type: 'text', nullable: true, default: null })
  cancelReason: string | null;

  // Set only when this row was created by a self-serve upgrade — points at the
  // enrollment it superseded (already Cancelled by the time this row exists). Null for
  // every other creation path (fresh purchase, admin grant, Basic self-enroll). See
  // SkillEnrollmentService.createEnrollmentLocked()'s upgrade branch — the sole writer.
  @Column({ type: 'integer', nullable: true, default: null })
  previousEnrollmentId: number | null;

  // DB-generated (see migration AddEnrollmentUpgradeSupport) — never set from application
  // code. Emulates a partial unique index (MySQL/MariaDB has no native one): NULL unless
  // status='active', with a UNIQUE INDEX on the column, so two Active rows for the same
  // (userId, subjectId) are physically impossible to insert. Read-only from TypeORM's
  // perspective; marked `select: false` so it never leaks into API responses by accident.
  @Column({ type: 'varchar', length: 64, nullable: true, select: false, insert: false, update: false })
  activeGuardKey: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;
}
