import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { INotification } from '../interface/notification.interface';
import { AbstractEntity } from './abstract.entity';

@Entity({ name: 'notifications' })
export class Notification extends AbstractEntity implements INotification {
  @Column({ type: 'int', nullable: false })
  userId: number;

  @Column({ type: 'varchar', length: 50, default: '' })
  title: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  message: string;

  @Column({ type: 'int', default: 0 })
  dataId: number;

  @Column({ type: 'varchar', length: 50, default: '' })
  dataTitle: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'boolean', default: false })
  notifyEmail: boolean;

  @Column({ type: 'boolean', default: false })
  notifySMS: boolean;

  @Column({ name: 'createdBy', default: null, select: false })
  createdBy: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;
}
