import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';

@Entity()
export class UserStreak extends AbstractEntity {
  @Column({ type: 'integer', nullable: false, unique: true })
  userId: number;

  @Column({ type: 'int', nullable: false, default: 0 })
  currentStreak: number;

  @Column({ type: 'int', nullable: false, default: 0 })
  longestStreak: number;

  @Column({ type: 'date', nullable: true, default: null })
  lastActiveDate: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  // Declared so the userId FK is part of the schema TypeORM generates (it previously
  // existed only as raw migration SQL).
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user?: User;
}
