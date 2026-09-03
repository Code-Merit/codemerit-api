import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QualityReviewOutcomeEnum } from 'src/common/enum/quality-review-outcome.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { IQuestion } from '../interface/question.interface';
import { AbstractEntity } from './abstract.entity';
import { QuestionTopic } from './quesion-topic.entity';
import { QuestionOption } from './question-option.entity';
import { Subject } from './subject.entity';
import { User } from './user.entity';

@Entity()
export class Question extends AbstractEntity implements IQuestion {
  @Column({ type: 'text', nullable: true, default: null })
  title: string;

  @Column({ type: 'text', nullable: false })
  question: string;

  @Column({
    type: 'integer',
    name: 'subjectId',
    nullable: false,
  })
  subjectId: number;

  @Column({
    type: 'enum',
    nullable: false,
    enum: QuestionTypeEnum,
    default: QuestionTypeEnum.General,
  })
  questionType: QuestionTypeEnum;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'int', default: 1 })
  marks: number;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    nullable: true,
    default: null,
  })
  slug: string;

  @Column({
    type: 'int',
    default: 60,
  })
  timeAllowed: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tag: string;

  @Column({
    type: 'enum',
    enum: QuestionStatusEnum,
    nullable: false,
    default: QuestionStatusEnum.Pending,
  })
  status: QuestionStatusEnum;

  @Column({
    type: 'boolean',
    default: false,
  })
  isWhitelisted: boolean;

  @Column({ type: 'text', nullable: true })
  answer: string;

  @Column({ type: 'text', nullable: true })
  hint: string;

  @Column({
    type: 'int',
    default: 1,
  })
  orderId: number;

  // SME quality-review rollups — denormalized from QualityReview so the LMS dashboard's
  // Quality Pipeline tab doesn't re-aggregate quality_review on every load. Updated
  // transactionally whenever a QualityReview transitions to Submitted (see
  // QuestionQualityService.upsertReview). reviewCount === 0 is the "never seen/reviewed
  // by an SME" signal, independent of `status`/`isWhitelisted` above.
  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @Column({ type: 'datetime', nullable: true, default: null })
  lastReviewedAt: Date | null;

  @Column({ type: 'int', nullable: true, default: null })
  latestGrade: number | null;

  @Column({
    type: 'enum',
    enum: QualityReviewOutcomeEnum,
    nullable: true,
    default: null,
  })
  lastReviewOutcome: QualityReviewOutcomeEnum | null;

  @Column({ name: 'createdBy', default: null, select: false })
  createdBy: number;

  @Column({ name: 'updatedBy', default: null, select: false })
  updatedBy: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => Subject, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subjectId', referencedColumnName: 'id' })
  subject: Subject;

  @OneToMany(() => QuestionTopic, (questionTopic) => questionTopic.question, {})
  questionTopics: QuestionTopic[];

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdBy', referencedColumnName: 'id' })
  userCreatedBy: User;

  @OneToMany(() => QuestionOption, (option) => option.question)
  options: QuestionOption[];
}
