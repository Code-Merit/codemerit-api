import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { Topic } from './topic.entity';
import { Question } from './question.entity';
import { IQuizQuestion } from '../interface/quiz-question.interface';
import { Quiz } from './quiz.entity';
import { UserQuiz } from './user-quiz.entity';
import { IQuizTopic } from '../interface/quiz-topic.interface';
import { QuizTypeEnum } from '../../enum/quiz-type.enum';

@Entity()
export class QuizTopic extends AbstractEntity implements IQuizTopic {
  @Column({
    type: 'integer',
    nullable: false,
  })
  topicId: number;

  // Exactly one of quizId/userQuizId is populated per row — see QuizQuestion for
  // the same convention/rationale.
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

  // Nullable purely so `synchronize: true` can add this column to a table that
  // already has rows without a default — see QuizQuestion for the same rationale.
  @Column({
    type: 'enum',
    enum: QuizTypeEnum,
    nullable: true,
  })
  quizType: QuizTypeEnum | null;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quizId', referencedColumnName: 'id' })
  quiz: Quiz;

  @ManyToOne(() => UserQuiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userQuizId', referencedColumnName: 'id' })
  userQuiz: UserQuiz;

  @ManyToOne(() => Topic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topicId', referencedColumnName: 'id' })
  topic: Topic;
}
