import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from 'src/common/typeorm/entities/notification.entity';
import { UserPreference } from 'src/common/typeorm/entities/user-preference.entity';
import { DEFAULT_USER_PREFERENCES } from 'src/common/utils/user-preference-defaults';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import { EmailService } from './email.service';
import { NOTIFICATION_MESSAGES } from '../constants/notification.constants';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepo: Repository<UserPreference>,
    private readonly emailService: EmailService,
  ) {}

  // No row (or an unset column) means "use the default," same as UserPreferenceService.
  private async isEmailEnabled(
    userId: number,
    key: 'emailAchievements' | 'emailEnrollmentConfirmations',
  ): Promise<boolean> {
    const row = await this.preferenceRepo.findOne({ where: { userId } });
    return row?.[key] ?? DEFAULT_USER_PREFERENCES[key];
  }

  private format(
    template: string,
    params: Record<string, string | number>,
  ): string {
    return template.replace(/\{(\w+)\}/g, (_, key) =>
      params[key] !== undefined ? String(params[key]) : `{${key}}`,
    );
  }

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      userId: dto.userId,
      title: dto.title ?? '',
      message: dto.message ?? '',
      dataId: dto.dataId ?? 0,
      dataTitle: dto.dataTitle ?? '',
      isRead: false,
      notifyEmail: dto.notifyEmail ?? false,
      notifySMS: dto.notifySMS ?? false,
    });

    return this.notificationRepo.save(notification);
  }

  async notifyRoleEnrolled(
    userId: number,
    name: string,
    jobRole: string,
    jobRoleId = 0,
  ): Promise<Notification> {
    const entity = this.notificationRepo.create({
      userId,
      title: 'Role Enrolled',
      message: this.format(NOTIFICATION_MESSAGES.ROLE_ENROLLED, {
        name,
        JobRole: jobRole,
      }),
      dataId: jobRoleId,
      dataTitle: jobRole,
      isRead: false,
      notifyEmail: false,
      notifySMS: false,
      createdBy: userId,
    });
    const saved = await this.notificationRepo.save(entity);
    if (await this.isEmailEnabled(userId, 'emailEnrollmentConfirmations')) {
      await this.emailService.sendRoleEnrolledEmail(userId, jobRole);
    }
    return saved;
  }

  async notifyAccountVerified(
    userId: number,
    name: string,
  ): Promise<Notification> {
    const entity = this.notificationRepo.create({
      userId,
      title: 'Account Verified',
      message: this.format(NOTIFICATION_MESSAGES.ACCOUNT_VERIFIED, { name }),
      dataId: 0,
      dataTitle: 'Account Verification',
      isRead: false,
      notifyEmail: false,
      notifySMS: false,
      createdBy: userId,
    });
    return this.notificationRepo.save(entity);
  }

  async notifyQuizCompleted(
    userId: number,
    quizName: string,
    score: number,
    quizId = 0,
  ): Promise<Notification> {
    const entity = this.notificationRepo.create({
      userId,
      title: 'Quiz Completed',
      message: this.format(NOTIFICATION_MESSAGES.QUIZ_COMPLETED, {
        QuizName: quizName,
        score,
      }),
      dataId: quizId,
      dataTitle: quizName,
      isRead: false,
      notifyEmail: false,
      notifySMS: false,
      createdBy: userId,
    });
    return this.notificationRepo.save(entity);
  }

  async notifyCertificateIssued(
    userId: number,
    trackTitle: string,
    certificateNumber: string,
    certificationTrackId = 0,
  ): Promise<Notification> {
    const entity = this.notificationRepo.create({
      userId,
      title: 'Certificate Earned',
      message: this.format(NOTIFICATION_MESSAGES.CERTIFICATE_ISSUED, {
        trackTitle,
        certificateNumber,
      }),
      dataId: certificationTrackId,
      dataTitle: trackTitle,
      isRead: false,
      notifyEmail: false,
      notifySMS: false,
      createdBy: userId,
    });
    const saved = await this.notificationRepo.save(entity);
    if (await this.isEmailEnabled(userId, 'emailAchievements')) {
      await this.emailService.sendCertificateIssuedEmail(
        userId,
        trackTitle,
        certificateNumber,
      );
    }
    return saved;
  }

  async notifyBadgeEarned(
    userId: number,
    badgeName: string,
    badgeId = 0,
  ): Promise<Notification> {
    const entity = this.notificationRepo.create({
      userId,
      title: 'Badge Earned',
      message: this.format(NOTIFICATION_MESSAGES.BADGE_EARNED, { badgeName }),
      dataId: badgeId,
      dataTitle: badgeName,
      isRead: false,
      notifyEmail: false,
      notifySMS: false,
      createdBy: userId,
    });
    const saved = await this.notificationRepo.save(entity);
    if (await this.isEmailEnabled(userId, 'emailAchievements')) {
      await this.emailService.sendBadgeEarnedEmail(userId, badgeName);
    }
    return saved;
  }

  async notifyStreakMilestone(
    userId: number,
    days: number,
  ): Promise<Notification> {
    const entity = this.notificationRepo.create({
      userId,
      title: 'Streak Milestone',
      message: this.format(NOTIFICATION_MESSAGES.STREAK_MILESTONE, { days }),
      dataId: days,
      dataTitle: `${days}-Day Streak`,
      isRead: false,
      notifyEmail: false,
      notifySMS: false,
      createdBy: userId,
    });
    const saved = await this.notificationRepo.save(entity);
    if (await this.isEmailEnabled(userId, 'emailAchievements')) {
      await this.emailService.sendStreakMilestoneEmail(userId, days);
    }
    return saved;
  }

  async notifyLevelUp(
    userId: number,
    level: number,
    levelTitle: string,
  ): Promise<Notification> {
    const entity = this.notificationRepo.create({
      userId,
      title: 'Level Up',
      message: this.format(NOTIFICATION_MESSAGES.LEVEL_UP, { level, levelTitle }),
      dataId: level,
      dataTitle: levelTitle,
      isRead: false,
      notifyEmail: false,
      notifySMS: false,
      createdBy: userId,
    });
    const saved = await this.notificationRepo.save(entity);
    if (await this.isEmailEnabled(userId, 'emailAchievements')) {
      await this.emailService.sendLevelUpEmail(userId, level, levelTitle);
    }
    return saved;
  }

  async findByUserId(userId = 0, limit = 50): Promise<Notification[]> {
    if (userId > 0) {
      return this.notificationRepo.find({
        where: { userId },
        take: limit,
        order: { id: 'DESC' },
      });
    }

    return this.notificationRepo.find({
      take: limit,
      order: { id: 'DESC' },
    });
  }
}
