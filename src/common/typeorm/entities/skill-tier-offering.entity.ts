import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

// A row's presence = "this subject offers this tier for purchase." Subject-only —
// there is no job-role-level offering (job roles aren't an enrollable scope at all,
// see SkillEnrollment). Basic never needs a row (universal, free, always available). A
// thin subject with no SME support simply has no Intern/Serious rows; a deep one with
// real mentors can have all four paid tiers.
@Index('IDX_skill_tier_offering_subjectId_tier', ['subjectId', 'tier'])
@Entity()
export class SkillTierOffering extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  subjectId: number;

  @Column({ type: 'enum', enum: EnrollmentTierEnum, nullable: false })
  tier: EnrollmentTierEnum;

  // Per-scope overrides — null falls back to the tier's default price/duration (see
  // pricing-catalog.constants.ts). Lets e.g. one subject's Serious mentorship cost and
  // last differently from another's.
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: null })
  priceInr: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, default: null })
  priceUsd: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  durationMonths: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', nullable: true, default: null })
  createdBy: number | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;
}
