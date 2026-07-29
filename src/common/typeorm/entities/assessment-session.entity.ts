import { RatingTypeEnum } from 'src/common/enum/rating-type.enum';
import { AssessmentSessionStatusEnum } from 'src/common/enum/assessment-session-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { IAssessmentSession } from '../interface/assessment-session.interface';
import { AbstractEntity } from './abstract.entity';
import { SkillRating } from './skill-rating.entity';
import { User } from './user.entity';
import { Type } from 'class-transformer';
import { Interview } from './interview.entity';

@Entity()
export class AssessmentSession
  extends AbstractEntity
  implements IAssessmentSession {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Type(() => Number)
  @Column({
    type: 'integer',
    nullable: true,
    default: 0,
  })
  userId: number;

  @Column({
    type: 'integer',
    nullable: true,
    default: null,
  })
  candidateId?: number;

  @Column({ type: 'text', nullable: true, default: null })
  assessmentTitle: string;

  @Column({ type: 'text', nullable: true, default: null })
  notes?: string;

  @Column({
    type: 'integer',
    nullable: true,
    default: null,
  })
  ratedBy?: number;

  @Column({
    type: 'enum',
    enum: RatingTypeEnum,
    default: RatingTypeEnum.SELF,
  })
  ratingType: RatingTypeEnum;

  @Column({ name: 'createdBy', default: null, select: false })
  createdBy: number;

  @Column({ name: 'updatedBy', default: null, select: false })
  updatedBy: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @OneToMany(() => SkillRating, (rating) => rating.assessmentSession, {
    cascade: true,
    eager: true,
  })
  skillRatings?: SkillRating[];

  @Column({
    nullable: true,
  })
  interviewId?: number;

  @Column({
    type: 'integer',
    nullable: true,
    default: null,
  })
  interviewerId?: number;

  // Interview "round" fields — only meaningful when ratingType === INTERVIEW.
  // Each round of a multi-round interview gets its own row here.
  @Column({
    type: 'int',
    nullable: true,
  })
  roundNumber?: number;

  @Column({
    type: 'enum',
    enum: AssessmentSessionStatusEnum,
    nullable: true,
  })
  status?: AssessmentSessionStatusEnum;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  scheduledAt?: Date;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  startedAt?: Date;

  @Column({
    type: 'datetime',
    nullable: true,
  })
  completedAt?: Date;

  @Column({
    type: 'text',
    nullable: true,
  })
  feedback?: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  declineReason?: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'candidateId', referencedColumnName: 'id' })
  candidate?: User;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'ratedBy', referencedColumnName: 'id' })
  rater: User;
  //score should be able to calculated from the skill ratings, so we can remove it from here to avoid redundancy and inconsistency

  @ManyToOne(
    () => Interview,
    (interview) => interview.assessmentSessions,
  )
  
  @JoinColumn({
    name: 'interviewId',
  })
  interview: Interview;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'interviewerId', referencedColumnName: 'id' })
  interviewer?: User;
}
