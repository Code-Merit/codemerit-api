import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiUsage } from 'src/common/typeorm/entities/api-usage.entity';
import { ApiUsageDaily } from 'src/common/typeorm/entities/api-usage-daily.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);

  constructor(
    @InjectRepository(ApiUsage)
    private readonly apiUsageRepo: Repository<ApiUsage>,
    @InjectRepository(ApiUsageDaily)
    private readonly apiUsageDailyRepo: Repository<ApiUsageDaily>,
  ) {}

  async track(userId: number): Promise<void> {
    // Daily bucket — atomic increment first, insert only for the day's first request. (Not
    // INSERT … ON DUPLICATE KEY UPDATE: InnoDB burns an AUTO_INCREMENT id on every duplicate,
    // leaving a gap per request.) A concurrent first-insert loses on the unique key and retries
    // the increment. CURDATE() keeps "today" on the DB's own calendar, same as usageSummary().
    // Its own try: a failure here (e.g. migration not yet run) must never skip the total below.
    try {
      const increment = () =>
        this.apiUsageDailyRepo.query(
          'UPDATE api_usage_daily SET count = count + 1 WHERE userId = ? AND day = CURDATE()',
          [userId],
        );
      if ((await increment())?.affectedRows === 0) {
        try {
          await this.apiUsageDailyRepo.query(
            'INSERT INTO api_usage_daily (userId, day, count) VALUES (?, CURDATE(), 1)',
            [userId],
          );
        } catch (error: any) {
          if (error?.code !== 'ER_DUP_ENTRY') throw error;
          await increment();
        }
      }
    } catch (error) {
      this.logger.error('Failed to track daily API usage', error as any);
    }

    try {
      const now = new Date();

      const row = await this.apiUsageRepo.findOne({ where: { userId } });

      if (row) {
        row.count += 1;
        row.lastHitAt = now;
        await this.apiUsageRepo.save(row);
        return;
      }

      await this.apiUsageRepo.save(
        this.apiUsageRepo.create({ userId, count: 1, lastHitAt: now }),
      );
    } catch (error) {
      this.logger.error('Failed to track API usage', error as any);
    }
  }

  /** All-time total + last hit (api_usage), and today / last-7-days counts (api_usage_daily —
   * these only cover days since that table was introduced). */
  async usageSummary(userId: number): Promise<{ total: number; week: number; today: number; lastHitAt: Date | null }> {
    const [row, windows] = await Promise.all([
      this.findByUserId(userId),
      this.apiUsageDailyRepo
        .createQueryBuilder('d')
        .select('COALESCE(SUM(d.count), 0)', 'week')
        .addSelect('COALESCE(SUM(CASE WHEN d.day = CURDATE() THEN d.count ELSE 0 END), 0)', 'today')
        .where('d.userId = :userId', { userId })
        .andWhere('d.day >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)')
        .getRawOne(),
    ]);
    return {
      total: row?.count ?? 0,
      week: Number(windows?.week) || 0,
      today: Number(windows?.today) || 0,
      lastHitAt: row?.lastHitAt ?? null,
    };
  }

  async findByUserId(userId: number): Promise<ApiUsage | null> {
    return this.apiUsageRepo.findOne({ where: { userId } });
  }

  async findMapByUserIds(userIds: number[]): Promise<Map<number, ApiUsage>> {
    if (!userIds.length) {
      return new Map<number, ApiUsage>();
    }

    const rows = await this.apiUsageRepo.find({
      where: { userId: In(userIds) },
    });

    return new Map(rows.map((row) => [row.userId as number, row]));
  }
}
