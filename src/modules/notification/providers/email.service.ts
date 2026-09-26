import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/common/typeorm/entities/user.entity';
import { MailService } from 'src/common/mail/providers/mail.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  private async getRecipient(
    userId: number,
  ): Promise<{ email: string; name: string } | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['email', 'firstName'],
    });
    if (!user?.email) return null;
    return { email: user.email, name: user.firstName || 'there' };
  }

  private handleFailure(event: string, userId: number, error: unknown): void {
    this.logger.error(
      `Failed to send ${event} e-mail to userId=${userId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  async sendRoleEnrolledEmail(
    userId: number,
    jobRoleTitle: string,
  ): Promise<void> {
    try {
      const recipient = await this.getRecipient(userId);
      if (!recipient) return;
      await this.mailService.sendRoleEnrolledEmail(
        recipient.email,
        recipient.name,
        jobRoleTitle,
      );
    } catch (error) {
      this.handleFailure('role-enrolled', userId, error);
    }
  }

  async sendCertificateIssuedEmail(
    userId: number,
    trackTitle: string,
    certificateNumber: string,
  ): Promise<void> {
    try {
      const recipient = await this.getRecipient(userId);
      if (!recipient) return;
      await this.mailService.sendCertificateIssuedEmail(
        recipient.email,
        recipient.name,
        trackTitle,
        certificateNumber,
      );
    } catch (error) {
      this.handleFailure('certificate-issued', userId, error);
    }
  }

  async sendBadgeEarnedEmail(userId: number, badgeName: string): Promise<void> {
    try {
      const recipient = await this.getRecipient(userId);
      if (!recipient) return;
      await this.mailService.sendBadgeEarnedEmail(
        recipient.email,
        recipient.name,
        badgeName,
      );
    } catch (error) {
      this.handleFailure('badge-earned', userId, error);
    }
  }

  async sendStreakMilestoneEmail(userId: number, days: number): Promise<void> {
    try {
      const recipient = await this.getRecipient(userId);
      if (!recipient) return;
      await this.mailService.sendStreakMilestoneEmail(
        recipient.email,
        recipient.name,
        days,
      );
    } catch (error) {
      this.handleFailure('streak-milestone', userId, error);
    }
  }

  async sendLevelUpEmail(
    userId: number,
    level: number,
    levelTitle: string,
  ): Promise<void> {
    try {
      const recipient = await this.getRecipient(userId);
      if (!recipient) return;
      await this.mailService.sendLevelUpEmail(
        recipient.email,
        recipient.name,
        level,
        levelTitle,
      );
    } catch (error) {
      this.handleFailure('level-up', userId, error);
    }
  }

  async sendDailyEngagementEmail(
    userId: number,
    attemptCount: number,
  ): Promise<void> {
    try {
      const recipient = await this.getRecipient(userId);
      if (!recipient) return;
      await this.mailService.sendDailyEngagementEmail(
        recipient.email,
        recipient.name,
        attemptCount,
      );
    } catch (error) {
      this.handleFailure('daily-engagement', userId, error);
    }
  }
}
