import { Column, Entity } from "typeorm";
import { AbstractEntity } from "./abstract.entity";

@Entity()
export class SkillMetric extends AbstractEntity {
  @Column()
  title: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    default: 5,
  })
  maxScore: number;

  @Column({ default: false })
  isRequired?: boolean;

  @Column({
    default: true,
  })
  isActive: boolean;
}