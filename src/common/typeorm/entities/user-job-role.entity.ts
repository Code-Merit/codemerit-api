import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { JobRole } from './job-role.entity';
import { IUserJobRole } from '../interface/user-job-role.interface';

@Entity('user_job_role')
export class UserJobRole implements IUserJobRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  userId: number;

  @Column({ type: 'int', nullable: false })
  jobRoleId: number;

  @Column({ type: 'int', nullable: true, default: null })
  createdBy: number;

  @Column({ type: 'int', nullable: true, default: null })
  updatedBy: number;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user?: User;

  @ManyToOne(() => JobRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobRoleId', referencedColumnName: 'id' })
  jobRole?: JobRole;
}
