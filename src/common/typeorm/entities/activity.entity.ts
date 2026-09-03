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

  // Who performed the action, when it differs from the subject (userId) — e.g. an admin
  // granting a badge to another user. Null means system/self-triggered, mirroring the
  // UserBadge.awardedBy / InterviewStatusHistory.changedBy actor-vs-subject pattern.
  @Column({
    nullable: true,
  })
  actorId?: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  device?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  client?: string;

  @Column({
    type: 'varchar',
    length: 45,
    nullable: true,
  })
  ipAddress?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
  })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'actorId',
  })
  actor?: User;
}
