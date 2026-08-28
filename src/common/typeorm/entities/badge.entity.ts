import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BadgeAwardMethodEnum } from 'src/common/enum/badge-award-method.enum';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { BadgeRule } from './badge-rule.entity';

@Entity({ name: 'badge' })
export class Badge {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  code: string;
  
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }) => value.trim())
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  @Column({ type: 'varchar', length: 100 })
  description: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  @Column({ type: 'varchar', length: 255 })
  content: string;

  @IsNotEmpty()
  @IsString()
  @Column({ type: 'varchar', length: 1000 })
  iconUrl: string;

  @Column({ type: 'int', default: 0 })
  points: number;

  /** What this badge is awarded for: the whole platform (e.g. "7-Day Streak"), or a
   * specific skill (e.g. "JavaScript Expert" for the JavaScript subject). */
  @Column({ type: 'enum', enum: BadgeScopeEnum, default: BadgeScopeEnum.GLOBAL })
  scopeType: BadgeScopeEnum;

  /** Id into Subject, JobRole, or Topic depending on scopeType — unset (null) for GLOBAL badges.
   * Not a foreign key, same polymorphic-reference pattern as SkillRating.skillId/skillType. */
  @Column({ type: 'int', nullable: true, default: null })
  scopeId: number | null;

  /** Display hint only — "how this badge is primarily earned." Does NOT gate anything by
   * itself; see isManuallyGrantable for the actual grant-endpoint check, and BadgeRule (a
   * separate table) for whether this badge is also auto-evaluated. */
  @Column({ type: 'enum', enum: BadgeAwardMethodEnum, default: BadgeAwardMethodEnum.SYSTEM })
  awardMethod: BadgeAwardMethodEnum;

  /** The real gate grantBadge() checks — independent of whether a BadgeRule also exists, so a
   * badge can be auto-only (rule, no manual grant), manual-only (no rule), or both. Defaults to
   * false (secure-by-default): a badge must explicitly opt in to being manually grantable, so a
   * new badge added without specifying this can never be accidentally handed out by a person. */
  @Column({ type: 'boolean', default: false })
  isManuallyGrantable: boolean;

  /** Disables further grants/auto-awards without deleting the badge or any already-earned
   * UserBadge rows — those stay visible on a learner's profile regardless. */
  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  /** Display order *within one scope* (e.g. among a single subject's badges) — lower sorts
   * first. Only meaningful relative to other badges sharing the same scopeType+scopeId; not
   * globally unique (every subject's "Beginner" badge can use the same value). Convention:
   * easiest-to-earn badge in a scope gets the lowest number, hardest the highest. */
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToOne(() => BadgeRule, (r) => r.badge)
  rule?: BadgeRule;

  constructor(data: Partial<Badge> = {}) {
    Object.assign(this, data);
  }
}
