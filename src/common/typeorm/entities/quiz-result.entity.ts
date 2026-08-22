import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
} from 'typeorm';
import { IQuizResult } from '../interface/quiz-result.interface';
import { AbstractEntity } from './abstract.entity';
import { Quiz } from './quiz.entity';
import { UserQuiz } from './user-quiz.entity';
import { User } from './user.entity';
import { QuizStatusEnum } from 'src/common/enum/quiz-status.enum';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';

@Entity()
export class QuizResult extends AbstractEntity implements IQuizResult {
    @Column({
        type: 'varchar',
        length: 10,
        nullable: false,
        unique: true
    })
    resultCode: string;

    @Column({
        type: 'integer',
        name: 'userId',
        nullable: false,
    })
    userId: number;

    // Exactly one of quizId/userQuizId is populated per row — quizId for a Standard
    // quiz (FK -> quiz.id), userQuizId for a UserQuiz (FK -> user_quiz.id). Both use
    // ON DELETE SET NULL (not CASCADE): a future UserQuiz purge job can delete the
    // practice quiz + its authoring rows while this result/score history survives —
    // quizType stays put on the row even after the FK nulls out, so "this was a
    // UserQuiz that's since been deleted" is still knowable.
    @Column({
        type: 'integer',
        name: 'quizId',
        nullable: true,
    })
    quizId: number | null;

    @Column({
        type: 'integer',
        name: 'userQuizId',
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

    @Column({
        type: 'integer',
        nullable: true,
        default:null
    })
    total: number;

    @Column({
        type: 'integer',
        nullable: true,
        default:null
    })
    correct: number;

    @Column({
        type: 'integer',
        nullable: true,
        default:null
    })
    wrong: number;

    @Column({
        type: 'integer',
        nullable: true,
        default:null
    })
    unanswered: number;

    @Column({
        type: 'integer',
        nullable: true,
        default:null
    })
    timeSpent: number;

    @Column({
        type: 'float',
        nullable: true,
        default:null
    })
    score: number;

    @Column({
        type: 'varchar',
        length: 255,
        nullable: true,
        default:null
    })
    remarks?: string;

    @Column({
        type: 'text',
        nullable: true,
        default:null
    })
    feedback?: string;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
        default:null
    })
    device?: string;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
        default:null
    })
    client?: string;

    @Column({
        type: 'varchar',
        length: 45,
        nullable: true,
        default:null
    })
    ipAddress?: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({
        type: 'enum',
        enum: QuizStatusEnum,
        default: QuizStatusEnum.InProgress,
    })
    status: QuizStatusEnum;

     @ManyToOne(() => Quiz, (quiz) => quiz.results, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quizId', referencedColumnName: 'id' })
  quiz: Quiz;

  @ManyToOne(() => UserQuiz, (userQuiz) => userQuiz.results, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userQuizId', referencedColumnName: 'id' })
  userQuiz: UserQuiz;

  @ManyToOne(() => User, (user) => user.quizResults, { eager: true })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;
}
