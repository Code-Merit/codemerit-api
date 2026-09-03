import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AbstractEntity } from './abstract.entity';
import { User } from './user.entity';
import { Permission } from './permission.entity';
import { PermissionRequestStatusEnum } from 'src/common/enum/permission-request-status.enum';

@Entity()
export class PermissionRequest extends AbstractEntity {
  @Column()
  userId: number;

  @Column()
  permissionId: number;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  resourceType?: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  resourceId?: number | null;

  @Column({ type: 'text' })
  comment: string;

  @Column({
    type: 'enum',
    enum: PermissionRequestStatusEnum,
    default: PermissionRequestStatusEnum.PENDING,
  })
  status: PermissionRequestStatusEnum;

  @Column({ nullable: true, default: null })
  reviewedBy?: number | null;

  @Column({ type: 'text', nullable: true, default: null })
  reviewComment?: string | null;

  @Column({ nullable: true, default: null })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permissionId', referencedColumnName: 'id' })
  permission: Permission;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedBy', referencedColumnName: 'id' })
  reviewer?: User;
}
