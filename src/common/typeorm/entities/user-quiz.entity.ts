import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  UpdateDateColumn,
} from 'typeorm';
import { TopicLabelEnum } from '../../enum/topic-label.enum';
import { DifficultyLevelEnum } from '../../enum/difficulty-lavel.enum';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';
import { QuizQuestion } from './quiz-quesion.entity';
import { QuestionAttempt } from './question-attempt.entity';
import { QuizResult } from './quiz-result.entity';
import { QuizSettings } from './quiz-settings.entity';
import { QuizSubject } from './quiz-subject.entity';

// Learner-generated practice quiz (formerly Quiz rows with quizType='UserQuiz') —
// ephemeral, prunable over time, kept in its own table so a future retention/purge
// job can never touch curated Standard content living in `quiz`. Same column shape
// as `Quiz` minus `quizType` (this table IS the UserQuiz type) and `isPublished`
// (not a meaningful concept for a learner's own practice quiz).
@Entity('user_quiz')
export class UserQuiz extends AbstractEntity {
  @Column({ type: 'varchar', length: 200, nullable: false })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  image: string;

  @Column({
    type: 'enum',
    enum: TopicLabelEnum,
    nullable: false,
    default: TopicLabelEnum.Foundation,
  })
  label: TopicLabelEnum;

  @Column({ type: 'varchar', length: 200, nullable: true, default: null })
  shortDesc: string;

  @Column({ type: 'varchar', length: 100, nullable: true, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 200, nullable: true, default: null })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  goal: string;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  tag: string;

  @Column({ type: 'varchar', length: 100, nullable: false, default: 'Default' })
  category: string;

  @Column({
    type: 'enum',
    enum: DifficultyLevelEnum,
    nullable: false,
    default: DifficultyLevelEnum.Easy,
  })
  level: DifficultyLevelEnum;

  @Column({ name: 'createdBy', default: null, select: false })
  createdBy: number;

  @Column({ name: 'updatedBy', default: null, select: false })
  updatedBy: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy', referencedColumnName: 'id' })
  userCreatedBy: User;

  @OneToMany(() => QuizQuestion, (quizQuestion) => quizQuestion.userQuiz, {
    cascade: true,
  })
  quizQuestions: QuizQuestion[];

  @OneToMany(() => QuestionAttempt, (qa) => qa.userQuiz, { cascade: false })
  questionAttempts: QuestionAttempt[];

  @OneToMany(() => QuizResult, (result) => result.userQuiz)
  results: QuizResult[];

  @OneToOne(() => QuizSettings, (settings) => settings.userQuiz, {
    nullable: true,
    cascade: true,
  })
  settings: QuizSettings;

  @OneToMany(() => QuizSubject, (quizSubject) => quizSubject.userQuiz)
  quizSubjects: QuizSubject[];
}
