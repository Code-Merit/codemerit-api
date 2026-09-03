import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { IQuestionOption } from '../interface/question-option.interface';
import { Question } from './question.entity';

@Entity()
export class QuestionOption extends AbstractEntity implements IQuestionOption {
  // Widened from 100 on 2026-08-23 — MySQL was silently truncating longer
  // scenario-explanation correct answers mid-word (varchar truncates, doesn't
  // error). Kept in sync with the DB-side ALTER TABLE so synchronize:true never
  // has to reconcile a length drift on its own — see feedback_synchronize_true_danger.
  @Column({ type: 'varchar', length: 255, nullable: false })
  option: string;

  @Column({ default: false })
  correct: boolean;

  @Column({
    type: 'varchar',
    nullable: true,
    default: null,
    length: 200,
  })
  comment: string;

  @Column({
    type: 'integer',
    nullable: false,
  })
  questionId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId', referencedColumnName: 'id' })
  question: Question;
}
