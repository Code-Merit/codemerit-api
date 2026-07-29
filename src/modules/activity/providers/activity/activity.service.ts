import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Activity } from 'src/common/typeorm/entities/activity.entity';
import { MailService } from 'src/common/mail/providers/mail.service';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    private readonly mailService: MailService,
  ) {}

  async createActivity(
    userId: number,
    title: string,
    message: string,
    dataId?: string,
    dataType?: string,
  ): Promise<Activity> {
    try {
      const activity = this.activityRepository.create({
        userId,
        title,
        message,
        dataId,
        dataType,
      });

      const savedActivity = await this.activityRepository.save(activity);

      this.logger.log(`Activity created successfully for userId=${userId}`);

      return savedActivity;
    } catch (error) {
      this.logger.error(
        `Failed to create activity for userId=${userId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async findByUserId(userId: number, limit = 20): Promise<Activity[]> {
    return this.activityRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
