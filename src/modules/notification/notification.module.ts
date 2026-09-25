import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from 'src/common/typeorm/entities/notification.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserPreference } from 'src/common/typeorm/entities/user-preference.entity';
import { MailModule } from 'src/common/mail/mail.module';
import { NotificationController } from './notification.controller';
import { EmailService } from './providers/email.service';
import { NotificationService } from './providers/notification.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User, UserPreference]), MailModule],
  controllers: [NotificationController],
  providers: [EmailService, NotificationService],
  exports: [EmailService, NotificationService],
})
export class NotificationModule {}
