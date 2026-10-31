import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';

// The learning dashboard's daily-quest bonus: one row per user per day, written when the bonus
// XP is claimed. The unique key is what stops a day's bonus being claimed twice.
@Unique('UQ_daily_quest_bonus_user_date', ['userId', 'questDate'])
@Entity('daily_quest_bonus')
export class DailyQuestBonus extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  userId: number;

  // Server-local calendar day the three quests were completed on.
  @Column({ type: 'date', nullable: false })
  questDate: string;

  @Column({ type: 'int', nullable: false })
  xpAwarded: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
