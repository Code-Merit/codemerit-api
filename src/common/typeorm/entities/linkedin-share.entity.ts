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
export class LinkedinShare extends AbstractEntity {
  @Column({ nullable: false })
  userId: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  url?: string;

  @Column({ type: 'longtext', nullable: true })
  imageDataUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imageFileName?: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  imageUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedinUrn?: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
