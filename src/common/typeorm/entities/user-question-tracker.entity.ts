import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { Question } from './question.entity';
import { User } from './user.entity';

// One row per (userId, questionId) — enforced below so a question can only ever be marked
// complete once per user; a repeat "mark complete" call is a no-op that returns the existing
// row rather than erroring or creating a duplicate row. No status/undo column by design —
// General question completion is one-way, matching the frontend's static "Completed"
// indicator (no toggle-off).
@Unique(['userId', 'questionId'])
@Entity('user_question_tracker')
export class UserQuestionTracker extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  userId: number;

  @Column({ type: 'integer', nullable: false })
  questionId: number;

  @CreateDateColumn({ name: 'completedAt' })
  completedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: Question;
}
