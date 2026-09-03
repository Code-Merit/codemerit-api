import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { LessonSection } from './lesson-section.entity';
import { Subject } from './subject.entity';
import { Topic } from './topic.entity';
import { User } from './user.entity';
import { UserLessonTracker } from './user-lesson-tracker.entity';

@Entity()
export class Lesson extends AbstractEntity {
  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'integer',
    nullable: false,
  })
  subjectId: number;

  @Column({
    type: 'integer',
    nullable: false,
  })
  topicId: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  slug: string;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({
    type: 'varchar',
    length: 300,
    nullable: false,
  })
  summary: string;

  /** Content-structure tag from the old blocks-based system, now repurposed purely as a
   * monetization/access category — evaluateLessonAccess() in lesson.service.ts treats
   * `format === 'comic'` as always-free regardless of subject premium status. Every
   * lesson is now authored as the same rich-text `content` shape (see LessonSection);
   * `format` no longer implies a different content structure, only this pricing rule. */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'tutorial',
  })
  format: 'comic' | 'tutorial' | 'reference';

  // 'simple-json' (not 'json') deliberately — MariaDB has no native JSON type (it's a
  // LONGTEXT alias), and TypeORM's schema-diff never recognizes that as a match for a
  // 'json' column, so every synchronize (i.e. every dev server restart) silently
  // DROP+ADDs this column. Repeated instant DROP/ADD COLUMN cycles accumulate InnoDB's
  // internal row-size bookkeeping until `lesson` trips the 8126-byte row limit and the
  // app refuses to boot ("Row size too large"). 'simple-json' stores as plain TEXT
  // (stable type match, no flapping) and still round-trips as string[] | null exactly
  // like 'json' did — no application code changes needed.
  @Column({
    type: 'simple-json',
    nullable: true,
  })
  tags: string[] | null;

  // Quality/merchandising signal only — does NOT gate access on its own (Basic-tier
  // users still see premium lessons, subject to the normal daily cap/ceiling rules).
  @Column({
    type: 'boolean',
    default: false,
  })
  isPremium: boolean;

  @Column({
    type: 'integer',
    nullable: false,
  })
  userId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => Subject, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @ManyToOne(() => Topic, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'topicId' })
  topic: Topic;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => LessonSection, (section) => section.lesson, {
    cascade: true,
  })
  sections: LessonSection[];

  @OneToMany(() => UserLessonTracker, (tracker) => tracker.lesson)
  userTrackers: UserLessonTracker[];
}
