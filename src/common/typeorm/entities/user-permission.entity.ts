import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { User } from './user.entity';
import { Permission } from './permission.entity';
import { IUserPermission } from '../interface/user-permission.interface';

@Entity()
export class UserPermission implements IUserPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  permissionId: number;

  // Values must match UserPermissionTitleEnum exactly (lowercase, e.g. 'subject-track') —
  // scoped permission lookups compare this with strict equality. NULL means "global" grant,
  // not scoped to any specific resource.
  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  resourceType?: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  resourceId?: number | null;

  @Column()
  userId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => User, user => user.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId', referencedColumnName: 'id' })
  permission: Permission;
}
