import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn
} from 'typeorm';
import { IQuestionAttempt } from '../interface/question-attempt.interface';
import { AbstractEntity } from './abstract.entity';
import { QuestionOption } from './question-option.entity';
import { Question } from './question.entity';
import { User } from './user.entity';
import { Quiz } from './quiz.entity';
import { UserQuiz } from './user-quiz.entity';
import { QuizResult } from './quiz-result.entity';
import { QuizTypeEnum } from '../../enum/quiz-type.enum';

// Speeds up the "latest attempt per question for a user" queries used throughout
// subject/topic/subject-track stats (WHERE userId = ? GROUP BY questionId) —
// without it MySQL falls back to a filesort/temp table for the GROUP BY.
@Index(['userId', 'questionId'])
// Speeds up mastery-leaderboard queries (MeritService), which scan ALL users
// scoped by question — the index above doesn't help there since it doesn't bind
// userId up front. questionId-leading lets MySQL drive from the (small) question
// set for a subject/track and index-only-lookup matching attempts.
@Index(['questionId', 'isCorrect', 'userId'])
@Entity()
export class QuestionAttempt extends AbstractEntity implements IQuestionAttempt {

  @Column({
    type: 'integer',
    nullable: false,
  })
  userId: number;

  @Column({
    type: 'integer',
    nullable: false,
  })
  questionId: number;

  // Exactly one of quizId/userQuizId is populated per row — see QuizResult for the
  // same convention/rationale (SET NULL, not CASCADE, to preserve attempt history
  // past a UserQuiz purge).
  @Column({ type: 'int', nullable: true })
  quizId: number | null;

  @Column({ type: 'int', nullable: true })
  userQuizId: number | null;

  // Links this attempt back to the specific submission it came from. Nullable —
  // pre-migration rows may be unbackfilled — so callers that need per-submission
  // scoping (e.g. QuizResultService.getQuizResultByCode) must fall back to the old
  // userId+quizId scoping when this is null, rather than assume it's always set.
  // Without this, retaking the same quiz merges every historical attempt into
  // every subsequent result's breakdown (confirmed live — see commit history).
  @Column({ type: 'int', nullable: true })
  resultId: number | null;

  // Nullable purely so `synchronize: true` can add this column to a table that
  // already has rows without a default — see QuizQuestion (quiz-quesion.entity.ts)
  // for the same rationale.
  @Column({ type: 'enum', enum: QuizTypeEnum, nullable: true })
  quizType: QuizTypeEnum | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  selectedOption: number;

  @Column({
    type: 'integer',
    nullable: true,
    default: 0
  })
  timeTaken: number;

  @Column({
    type: 'boolean',
    nullable: true,
    default: false,
  })
  isSkipped: boolean;

  @Column({
    type: 'boolean',
    nullable: true,
    default: false,
  })
  hintUsed: boolean;

  @Column({
    type: 'boolean',
    nullable: true,
    default: false,
  })
  isCorrect: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  answer?: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => User, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => QuestionOption, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'selectedOption', referencedColumnName: 'id' })
  selectedOptionDetails: QuestionOption;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'questionId', referencedColumnName: 'id' })
  question: Question;

  @ManyToOne(() => Quiz, (quiz) => quiz.questionAttempts, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quizId' })
  quiz: Quiz;

  @ManyToOne(() => UserQuiz, (userQuiz) => userQuiz.questionAttempts, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userQuizId' })
  userQuiz: UserQuiz;

  @ManyToOne(() => QuizResult, (result) => result.questionAttempts, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resultId' })
  result: QuizResult;
}