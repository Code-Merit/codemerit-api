import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { Lesson } from './lesson.entity';
import { User } from './user.entity';

// One tracker row per (userId, lessonId) — enforced below so concurrent "record access" calls
// can never fork a single user's progress on one lesson into two rows.
@Unique(['userId', 'lessonId'])
@Entity('user_lesson_tracker')
export class UserLessonTracker extends AbstractEntity {
  @Column({
    type: 'integer',
    nullable: false,
  })
  userId: number;

  @Column({
    type: 'integer',
    nullable: false,
  })
  lessonId: number;

  @Column({
    type: 'integer',
    nullable: false,
    default: 0,
  })
  views: number;

  @Column({
    type: 'enum',
    enum: UserLessonTrackerStatusEnum,
    nullable: false,
    default: UserLessonTrackerStatusEnum.Pending,
  })
  status: UserLessonTrackerStatusEnum;

  @Column({
    type: 'int',
    nullable: false,
    default: 0,
  })
  progressPercent: number;

  @Column({
    type: 'text',
    nullable: true,
    default: null,
  })
  notes: string;

  // Independent of status/progressPercent by design — a learner can rate usefulness/quality
  // whether or not they ever complete the lesson. Overwritten (not accumulated) on every
  // rating submission, so this is the learner's latest rating, not a history of ratings.
  @Column({
    type: 'int',
    nullable: true,
    default: null,
  })
  usefulRating: number | null;

  @Column({
    type: 'int',
    nullable: true,
    default: null,
  })
  qualityRating: number | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.lessonTrackers)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Lesson, (lesson) => lesson.userTrackers)
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
}
