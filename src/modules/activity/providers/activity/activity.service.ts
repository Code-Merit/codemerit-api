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
    options?: {
      dataId?: string;
      dataType?: string;
      actorId?: number;
      ipAddress?: string;
      device?: string;
      client?: string;
    },
  ): Promise<Activity> {
    try {
      const activity = this.activityRepository.create({
        userId,
        title,
        message,
        dataId: options?.dataId,
        dataType: options?.dataType,
        actorId: options?.actorId,
        ipAddress: options?.ipAddress,
        device: options?.device,
        client: options?.client,
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

  // Deliberately omits ipAddress/device/client — those are audit metadata for the admin feed,
  // not something a user's own "mine" feed needs to expose. `actor` is still joined so the
  // frontend can render a "· by {actor}" annotation when someone else acted on the caller's
  // behalf (e.g. an admin-granted badge).
  async findByUserId(userId: number, limit = 20): Promise<Activity[]> {
    return this.activityRepository
      .createQueryBuilder('activity')
      .leftJoin('activity.actor', 'actor')
      .where('activity.userId = :userId', { userId })
      .select([
        'activity.id',
        'activity.userId',
        'activity.title',
        'activity.message',
        'activity.dataId',
        'activity.dataType',
        'activity.actorId',
        'activity.createdAt',
      ])
      .addSelect(['actor.id', 'actor.username', 'actor.firstName', 'actor.lastName'])
      .orderBy('activity.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async findLatest(limit = DEFAULT_ADMIN_FEED_LIMIT): Promise<Activity[]> {
    return this.adminFeedQuery(limit).getMany();
  }

  // Idempotency check for events with no other persisted "already happened" flag to dedupe
  // against (e.g. subject-completion, which is computed live, not stored). Callers should check
  // this before creating a one-time activity so re-triggering the same event is a no-op.
  async existsForData(userId: number, dataType: string, dataId: string): Promise<boolean> {
    const count = await this.activityRepository.count({ where: { userId, dataType, dataId } });
    return count > 0;
  }

  // Admin-facing feed: a specific user's activity when `username` is given, otherwise the
  // latest activity across everyone. Defaults to 200 rather than `findByUserId`'s 20 — this is
  // a wide admin view, not a single user's own feed. Unlike `findByUserId` (used by the caller's
  // own "mine" feed, where embedding the caller's own identity would be redundant), this joins
  // in the owning user's id/username/name so an admin browsing everyone's activity can tell
  // whose "earned the First Steps badge" row they're looking at.
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
      .leftJoin('activity.actor', 'actor')
      .addSelect(['actor.id', 'actor.username', 'actor.firstName', 'actor.lastName'])
      .orderBy('activity.createdAt', 'DESC')
      .take(limit);
  }
}
