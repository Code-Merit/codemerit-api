import {
  Column,
  Entity,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractEntity } from './abstract.entity';

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
}
