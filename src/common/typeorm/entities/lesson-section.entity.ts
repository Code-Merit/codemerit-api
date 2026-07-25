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
    nullable: true,
    default: null,
  })
  description: string | null;

  @Column({
    type: 'json',
    nullable: true,
    default: null,
  })
  blocks: object[] | null;

  @ManyToOne(() => Lesson, (lesson) => lesson.sections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lessonId' })
  lesson: Lesson;
}
