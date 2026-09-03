import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { ITopic } from '../interface/topic.interface';
import { Subject } from './subject.entity';
import { TopicLabelEnum } from 'src/common/enum/topic-label.enum';

@Unique(['subjectId', 'title'])
@Entity()
export class Topic extends AbstractEntity implements ITopic {
  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'integer',
    name: 'subjectId',
    nullable: false,
  })
  subjectId: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  image: string;

  @Column({
    type: 'enum',
    enum: TopicLabelEnum,
    nullable: true,
    default: TopicLabelEnum.Foundation,
  })
  label: TopicLabelEnum;

  // Widened from 20 on 2026-08-23 — a 20-char cap meant 159 of 218 topics (73%) had
  // this silently truncated mid-word (MySQL varchar truncates, doesn't error). Kept
  // in sync with the DB-side ALTER TABLE — see feedback_synchronize_true_danger.
  @Column({
    type: 'varchar',
    length: 150,
    nullable: true,
    default: null,
  })
  shortDesc: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  slug: string;

  @Column({
    type: 'int',
    nullable: false,
    default: 1,
  })
  order: number;

  @Column({
    type: 'int',
    nullable: false,
    default: 1,
  })
  weight: number;

  @Column({
    type: 'int',
    nullable: true,
    default: 1,
  })
  popularity: number;

  @Column({
    type: 'integer',
    nullable: true,
    default: null,
  })
  parent?: number;

  @Column({
    type: 'boolean',
    default: true,
  })
  isPublished: boolean;

  @Column({
    type: 'text',
    nullable: true,
    default: null,
  })
  description: string;

  @Column({
    type: 'text',
    nullable: true,
    default: null,
  })
  goal: string;

  @Column({ name: 'updatedBy', default: null, select: false })
  updatedBy: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', select: false })
  updatedAt: Date;

  @ManyToOne(() => Subject, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @ManyToOne(() => Topic, (topic) => topic.subTopics, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent' })
  parentTopic?: Topic;

  @OneToMany(() => Topic, (topic) => topic.parentTopic)
  subTopics: Topic[];
}
