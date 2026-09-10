import { Column, CreateDateColumn, Entity, UpdateDateColumn } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

// Admin-editable daily question caps per tier — replaces hardcoded constants so
// numbers can change without a redeploy. Only Basic and Curious ever need a row
// (Pro/Intern/Serious are always unlimited by design); if a tier has no row, the
// service falls back to a hardcoded default (see skill-enrollment.constants.ts).
// Lessons are no longer capped here at all — see Lesson.accessLevel instead.
@Entity()
export class EnrollmentTierCapConfig extends AbstractEntity {
  @Column({ type: 'enum', enum: EnrollmentTierEnum, unique: true, nullable: false })
  tier: EnrollmentTierEnum;

  @Column({ type: 'int', nullable: false })
  dailyQuestionCap: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;
}
