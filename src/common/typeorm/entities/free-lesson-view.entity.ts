import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { AbstractEntity } from './abstract.entity';

// Ledger of free (Basic/Curious-tier) lesson views on premium subjects. No unique
// constraint — a new row per user+lesson is fine across different days; both "already
// viewed today" and "already viewed this lesson ever" are derived by querying
// createdAt, not by upserting. Two things read this: the daily lesson cap (today's
// distinct lessonId count) and the cumulative 40%-of-subject ceiling (all-time
// distinct lessonId count for that subject, Basic tier only). See LessonService.
@Index(['userId', 'lessonId'])
@Index(['userId', 'createdAt'])
@Index(['userId', 'subjectId'])
@Entity()
export class FreeLessonView extends AbstractEntity {
  @Column({ type: 'integer', nullable: false })
  userId: number;

  @Column({ type: 'integer', nullable: false })
  lessonId: number;

  // Denormalized from Lesson.subjectId (immutable per lesson) so the cumulative
  // per-subject ceiling check never needs a join back to lesson.
  @Column({ type: 'integer', nullable: false })
  subjectId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
