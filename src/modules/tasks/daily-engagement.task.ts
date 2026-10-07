import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { EmailService } from 'src/modules/notification/providers/email.service';

@Injectable()
export class DailyEngagementTask {
  private readonly logger = new Logger(DailyEngagementTask.name);

  constructor(
    @InjectRepository(QuestionAttempt)
    private readonly questionAttemptRepo: Repository<QuestionAttempt>,
    private readonly emailService: EmailService,
  ) {}

  // Fires daily at 8:00 PM (20:00) IST
  @Cron('0 20 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async handleDailyEngagementCron(): Promise<void> {
    this.logger.log(
      `CRON: Triggering daily engagement job at ${new Date().toISOString()} (20:00 Asia/Kolkata)...`,
    );
    try {
      const result = await this.processTopPerformers();
      this.logger.log(
        `CRON: Daily engagement job finished; eligible users=${result.processedCount}`,
      );
    } catch (error) {
      this.logger.error(
        `CRON: Daily engagement job failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  // Shared method so both CRON and manual test endpoint execute identical logic
  async processTopPerformers(): Promise<{
    processedCount: number;
    userIds: number[];
  }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.logger.log(
      `Querying daily engagement attempts since ${twentyFourHoursAgo.toISOString()} (threshold: > 10)`,
    );

    const topPerformers = await this.questionAttemptRepo
      .createQueryBuilder('qa')
      .select('qa.userId', 'userId')
      .addSelect('COUNT(qa.id)', 'attemptCount')
      .where('qa.createdAt >= :since', { since: twentyFourHoursAgo })
      .groupBy('qa.userId')
      .having('COUNT(qa.id) > :threshold', { threshold: 10 })
      .getRawMany<{ userId: number; attemptCount: string }>();

    this.logger.log(
      `Found ${topPerformers.length} users with > 10 attempts in last 24h`,
    );

    const processedUserIds: number[] = [];

    for (const record of topPerformers) {
      const count = parseInt(record.attemptCount, 10);
      this.logger.log(
        `Sending daily engagement email for userId=${record.userId}, attempts=${count}`,
      );
      await this.emailService.sendDailyEngagementEmail(record.userId, count);
      processedUserIds.push(record.userId);
    }

    return {
      processedCount: topPerformers.length,
      userIds: processedUserIds,
    };
  }
}
