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
import { User } from './user.entity';
import { QuizStatusEnum } from 'src/common/enum/quiz-status.enum';

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

    @Column({
        type: 'integer',
        name: 'quizId',
        nullable: false,
    })
    quizId: number;

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

     @ManyToOne(() => Quiz, (quiz) => quiz.results, { eager: true })
  @JoinColumn({ name: 'quizId', referencedColumnName: 'id' })
  quiz: Quiz;

  @ManyToOne(() => User, (user) => user.quizResults, { eager: true })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;
}
