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

  async track(userId: number): Promise<void> {
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
