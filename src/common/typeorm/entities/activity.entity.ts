import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { AbstractEntity } from 'src/common/typeorm/entities/abstract.entity';
import { User } from 'src/common/typeorm/entities/user.entity';

@Entity()
export class Activity extends AbstractEntity {
  @Column({
    nullable: false,
  })
  userId: number;

  @Column({
    type: 'varchar',
    length: 150,
  })
  title: string;

  @Column({
    type: 'text',
  })
  message: string;

  // Was `int` — widened to varchar so this can hold either a numeric id's string form (badge,
  // certification track, user) or a non-numeric public code (interviewCode for INTERVIEW-type
  // activities, since there's no lookup-by-numeric-id endpoint for interviews). See
  // migrate-activity-dataid-varchar.js.
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  dataId?: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  dataType?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({
    name: 'userId',
  })
  user: User;
}
