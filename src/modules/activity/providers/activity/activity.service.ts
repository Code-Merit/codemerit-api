import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Activity } from 'src/common/typeorm/entities/activity.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { MailService } from 'src/common/mail/providers/mail.service';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';

const DEFAULT_ADMIN_FEED_LIMIT = 200;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  async findLatest(limit = DEFAULT_ADMIN_FEED_LIMIT): Promise<Activity[]> {
    return this.adminFeedQuery(limit).getMany();
  }

  // Admin-facing feed: a specific user's activity when `username` is given, otherwise the
  // latest activity across everyone. Defaults to 200 rather than `findByUserId`'s 20 — this is
  // a wide admin view, not a single user's own feed. Unlike `findByUserId` (used by the caller's
  // own "mine" feed, where embedding the caller's own identity would be redundant), this joins
  // in the owning user's id/username/name so an admin browsing everyone's activity can tell
  // whose "You earned the First Steps badge" row they're looking at.
  async findForAdmin(
    username?: string,
    limit = DEFAULT_ADMIN_FEED_LIMIT,
  ): Promise<Activity[]> {
    if (!username) {
      return this.findLatest(limit);
    }

    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'User not found.');
    }

    return this.adminFeedQuery(limit)
      .andWhere('activity.userId = :userId', { userId: user.id })
      .getMany();
  }

  private adminFeedQuery(limit: number) {
    return this.activityRepository
      .createQueryBuilder('activity')
      .leftJoin('activity.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.firstName', 'user.lastName'])
      .orderBy('activity.createdAt', 'DESC')
      .take(limit);
  }
}
