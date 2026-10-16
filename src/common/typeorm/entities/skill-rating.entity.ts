import { SkillTypeEnum } from 'src/common/enum/skill-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { ISkillRating } from '../interface/skill-rating.interface';
import { AbstractEntity } from './abstract.entity';
import { AssessmentSession } from './assessment-session.entity';
import { RatingTypeEnum } from 'src/common/enum/rating-type.enum';

@Entity()
export class SkillRating extends AbstractEntity implements ISkillRating {
  @Column({
    type: 'integer',
    nullable: false,
    default: null,
  })
  assessmentSessionId: number;

  @Column({
    type: 'enum',
    enum: SkillTypeEnum,
    default: SkillTypeEnum.SUBJECT,
  })
  skillType: SkillTypeEnum;

  @Column({
    type: 'integer',
    nullable: true,
    default: null,
  })
  skillId: number;

  @Column({
    type: 'integer',
    nullable: false,
    default: 0,
  })
  rating: number;

  @Column({
    type: 'enum',
    enum: RatingTypeEnum,
    default: RatingTypeEnum.SELF,
  })
  ratingType: RatingTypeEnum;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => AssessmentSession, (session) => session.skillRatings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assessmentSessionId' })
  assessmentSession: AssessmentSession;
}
