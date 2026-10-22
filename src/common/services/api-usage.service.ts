import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiUsage } from 'src/common/typeorm/entities/api-usage.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);

  constructor(
    @InjectRepository(ApiUsage)
    private readonly apiUsageRepo: Repository<ApiUsage>,
  ) {}

  // Atomic increment first, insert only for the user's first request. A read-then-save loses counts
  // when a page fires several requests at once (each reads the same count and writes count + 1).
  // Not INSERT … ON DUPLICATE KEY UPDATE: InnoDB burns an AUTO_INCREMENT id on every duplicate.
  // A concurrent first insert loses on the unique key and retries the increment.
  async track(userId: number): Promise<void> {
    try {
      const now = new Date();
      const increment = () =>
        this.apiUsageRepo.query('UPDATE api_usage SET count = count + 1, lastHitAt = ? WHERE userId = ?', [now, userId]);

      if ((await increment())?.affectedRows === 0) {
        try {
          await this.apiUsageRepo.query('INSERT INTO api_usage (userId, count, lastHitAt) VALUES (?, 1, ?)', [userId, now]);
        } catch (error: any) {
          if (error?.code !== 'ER_DUP_ENTRY') throw error;
          await increment();
        }
      }
    } catch (error) {
      this.logger.error('Failed to track API usage', error as any);
    }
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
