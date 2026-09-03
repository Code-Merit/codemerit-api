import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { IQuestionTopic } from '../interface/question-topic.interface';
import { Topic } from './topic.entity';
import { Question } from './question.entity';

@Unique(['questionId', 'topicId'])
@Entity()
export class QuestionTopic extends AbstractEntity implements IQuestionTopic {
  @Column({
    type: 'integer',
    nullable: false,
  })
  questionId: number;

  @Column({
    type: 'integer',
    nullable: false,
  })
  topicId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => Topic, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topicId', referencedColumnName: 'id' })
  topic: Topic;

  @ManyToOne(() => Question, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId', referencedColumnName: 'id' })
  question: Question;
}
