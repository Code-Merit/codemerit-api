import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { Question } from './question.entity';
import { IQuizQuestion } from '../interface/quiz-question.interface';
import { Quiz } from './quiz.entity';
import { UserQuiz } from './user-quiz.entity';
import { QuizTypeEnum } from '../../enum/quiz-type.enum';

@Entity()
export class QuizQuestion extends AbstractEntity implements IQuizQuestion {
  @Column({
    type: 'integer',
    nullable: false,
  })
  questionId: number;

  // Exactly one of quizId/userQuizId is populated per row — quizId for Standard
  // (FK -> quiz.id), userQuizId for UserQuiz (FK -> user_quiz.id). quizType below
  // is the denormalized discriminator so reads never need to infer type from
  // which FK is non-null.
  @Column({
    type: 'integer',
    nullable: true,
  })
  quizId: number | null;

  @Column({
    type: 'integer',
    nullable: true,
  })
  userQuizId: number | null;

  // Nullable at the DB level (not nullable: false) purely so `synchronize: true`
  // can add this column to a table that already has rows without a default value —
  // every application code path always sets it explicitly on new rows; NULL only
  // ever occurs on pre-migration rows until the one-off backfill script runs.
  @Column({
    type: 'enum',
    enum: QuizTypeEnum,
    nullable: true,
  })
  quizType: QuizTypeEnum | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId', referencedColumnName: 'id' })
  quiz: Quiz;

  @ManyToOne(() => UserQuiz, (userQuiz) => userQuiz.quizQuestions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userQuizId', referencedColumnName: 'id' })
  userQuiz: UserQuiz;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId', referencedColumnName: 'id' })
  question: Question;
}
