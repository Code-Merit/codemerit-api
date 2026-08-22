import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { Quiz } from './quiz.entity';
import { UserQuiz } from './user-quiz.entity';
import { IQuizSubject } from '../interface/quiz-subject.interface';
import { Subject } from './subject.entity';
import { QuizTypeEnum } from '../../enum/quiz-type.enum';

@Entity()
export class QuizSubject extends AbstractEntity implements IQuizSubject {
  @Column({
    type: 'integer',
    nullable: false,
  })
  subjectId: number;

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

  @ManyToOne(() => UserQuiz, (userQuiz) => userQuiz.quizSubjects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userQuizId', referencedColumnName: 'id' })
  userQuiz: UserQuiz;

  @ManyToOne(() => Subject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subjectId', referencedColumnName: 'id' })
  subject: Subject;
}
