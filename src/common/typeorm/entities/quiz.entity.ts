import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { TopicLabelEnum } from 'src/common/enum/topic-label.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
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
import { IQuiz } from '../interface/quiz.interface';
import { AbstractEntity } from './abstract.entity';
import { QuizQuestion } from './quiz-quesion.entity';
import { User } from './user.entity';
import { QuestionAttempt } from './question-attempt.entity';
import { QuizResult } from './quiz-result.entity';
import { QuizSettings } from './quiz-settings.entity';
import { QuizSubject } from './quiz-subject.entity';

@Entity()
export class Quiz extends AbstractEntity implements IQuiz {
  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  image: string;

  @Column({
    type: 'enum',
    enum: TopicLabelEnum,
    nullable: false,
    default: TopicLabelEnum.Foundation,
  })
  label: TopicLabelEnum;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    default: null,
  })
  shortDesc: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  slug: string;

  @Column({
    type: 'enum',
    nullable: false,
    enum: QuizTypeEnum,
    default: QuizTypeEnum.UserQuiz,
  })
  quizType: QuizTypeEnum;

  @Column({
    type: 'boolean',
    default: false,
  })
  isPublished: boolean;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    default: null,
  })
  description: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    default: null,
  })
  goal: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    default: null,
  })
  tag: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    default: 'Default',
  })
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

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy', referencedColumnName: 'id' })
  userCreatedBy: User;

  @OneToMany(() => QuizQuestion, (quizQuestion) => quizQuestion.quiz, {
    cascade: true,
  })
  quizQuestions: QuizQuestion[];

  @OneToMany(() => QuestionAttempt, (qa) => qa.quiz, { cascade: false })
  questionAttempts: QuestionAttempt[];

  @OneToMany(() => QuizResult, (result) => result.quiz)
  results: QuizResult[];

  @OneToOne(() => QuizSettings, (settings) => settings.quiz, {
    nullable: true,
    cascade: true,
  })
  settings: QuizSettings;

  @OneToMany(
  () => QuizSubject,
  (quizSubject) => quizSubject.quiz,
)
quizSubjects: QuizSubject[];
}
