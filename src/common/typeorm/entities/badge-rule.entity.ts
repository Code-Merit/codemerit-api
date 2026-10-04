import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { Badge } from './badge.entity';
import { BadgeRuleMetricEnum } from 'src/common/enum/badge-rule-metric.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';

/**
 * A badge's auto-award criteria, split out from Badge itself so future rule-schema changes
 * (new metrics, new params) never ALTER the badge table — see the corruption incident this was
 * introduced to avoid. One rule per badge today (unique badgeId); relax to a one-to-many if a
 * badge ever needs multiple combined conditions.
 */
@Entity()
export class BadgeRule extends AbstractEntity {
  @Column({ type: 'int' })
  badgeId: number;

  @Column({ type: 'enum', enum: BadgeRuleMetricEnum })
  metric: BadgeRuleMetricEnum;

  /** e.g. 90 meaning "90%". */
  @Column({ type: 'int' })
  threshold: number;

  /** Numeric enum (Easy=1/Intermediate=2/Advanced=3), stored as a plain int — same convention
   * as Question.level. Null means "all difficulty levels combined" (the original behavior). */
  @Column({ type: 'int', nullable: true, default: null })
  difficultyLevel: DifficultyLevelEnum | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @OneToOne(() => Badge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badgeId' })
  badge: Badge;
}
