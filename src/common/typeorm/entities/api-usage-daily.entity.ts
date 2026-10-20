import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Per-user, per-day request counter — the rolling windows (today / last 7 days) that the single
// running total in api_usage can't answer. One row per (userId, day), upserted by
// ApiUsageService.track(). `day` is the server's local calendar date.
@Entity({ name: 'api_usage_daily' })
@Index('UQ_api_usage_daily_userId_day', ['userId', 'day'], { unique: true })
export class ApiUsageDaily {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  userId: number;

  @Column({ type: 'date', nullable: false })
  day: string;

  @Column({ type: 'int', default: 0 })
  count: number;
}
