import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'api_usage' })
@Index('UQ_api_usage_userId', ['userId'], { unique: true })
export class ApiUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  userId: number;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'timestamp', nullable: false })
  lastHitAt: Date;
}
