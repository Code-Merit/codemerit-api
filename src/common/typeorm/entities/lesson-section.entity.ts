import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { Lesson } from './lesson.entity';

@Entity()
export class LessonSection extends AbstractEntity {
  @Column({
    type: 'integer',
    nullable: false,
  })
  lessonId: number;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: false,
  })
  title: string;

  @Column({
    type: 'text',
    nullable: false,
  })
  content: string;

  @Column({
    type: 'int',
    default: 0,
  })
  orderIndex: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.sections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
}
