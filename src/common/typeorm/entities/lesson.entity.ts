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
    length: 20,
    nullable: false,
    default: 'tutorial'
  })
  format: 'comic' | 'tutorial' | 'reference';

  @Column({
    type: 'json',
    nullable: true,
    default: null,
  })
  tags: string[] | null;

  @Column({
    type: 'integer',
    nullable: false,
  })
  userId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @ManyToOne(() => Topic)
  @JoinColumn({ name: 'topicId' })
  topic: Topic;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => LessonSection, (section) => section.lesson, {
    cascade: true,
  })
  sections: LessonSection[];

  @OneToMany(() => UserLessonTracker, (tracker) => tracker.lesson)
  userTrackers: UserLessonTracker[];
}
