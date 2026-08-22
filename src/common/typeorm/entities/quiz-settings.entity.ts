import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Quiz } from './quiz.entity';
import { UserQuiz } from './user-quiz.entity';
import { OrderingEnum, ModeEnum } from '../../enum/quiz-settings.enum';
import { QuizTypeEnum } from '../../enum/quiz-type.enum';
import { IQuizSettings } from '../interface/quiz-settings.interface';

@Entity('quiz_settings')
export class QuizSettings implements IQuizSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  numQuestions: number;

  @Column({
    type: 'enum',
    enum: OrderingEnum,
    default: OrderingEnum.DEFAULT,
  })
  ordering: OrderingEnum;

  @Column({
    type: 'enum',
    enum: ModeEnum,
    default: ModeEnum.DEFAULT,
  })
  mode: ModeEnum;

  @Column({ type: 'boolean', default: false })
  showHint: boolean;

  @Column({ type: 'boolean', default: false })
  showAnswers: boolean;

  @Column({ type: 'boolean', default: false })
  enableNavigation: boolean;

  @Column({ type: 'boolean', default: false })
  enableAudio: boolean;

  @Column({ type: 'boolean', default: false })
  enableTimer: boolean;

  @Column({ type: 'boolean', default: false })
  enableCertificate: boolean;

  @Column({ type: 'int', default: 60 })
  passMarks: number;

  @Column({ type: 'int', default: 1 })
  maxAttempts: number;

  @Column({ type: 'boolean', default: false })
  enableReview: boolean;

  // Exactly one of quizId/userQuizId is populated per row — see QuizQuestion for
  // the same convention/rationale.
  @Column({ type: 'int', nullable: true })
  quizId: number | null;

  @Column({ type: 'int', nullable: true })
  userQuizId: number | null;

  // Nullable purely so `synchronize: true` can add this column to a table that
  // already has rows without a default — see QuizQuestion for the same rationale.
  @Column({ type: 'enum', enum: QuizTypeEnum, nullable: true })
  quizType: QuizTypeEnum | null;

  @OneToOne(() => Quiz, (quiz) => quiz.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId' })
  quiz: Quiz;

  @OneToOne(() => UserQuiz, (userQuiz) => userQuiz.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userQuizId' })
  userQuiz: UserQuiz;
}
