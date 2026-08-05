// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { UserOtp } from 'src/common/typeorm/entities/user-otp.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { UserStreak } from 'src/common/typeorm/entities/user-streak.entity';
import { UserOtpService } from './providers/user-otp.service';
import { UserProfileService } from './providers/user-profile.service';
import { UserProfileAggregatorService } from './providers/user-profile-aggregator.service';
import { UserService } from './providers/user.service';
import { UsersController } from './users.controller';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { MasterModule } from 'src/modules/master/master.module';
import { MailModule } from 'src/common/mail/mail.module';
import { UserPermissionModule } from 'src/modules/user-permission/user-permission.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { QuizModule } from 'src/modules/quiz/quiz.module';
import { AchievementModule } from 'src/modules/achievement/achievement.module';
import { BadgeQueryModule } from 'src/modules/achievement/badge-query.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, UserOtp, UserJobRole, JobRole, QuizResult, Certificate, UserStreak]),
    NotificationModule,
    MasterModule,
    MailModule,
    UserPermissionModule,
    ActivityModule,
    QuizModule,
    AchievementModule,
    BadgeQueryModule,
  ],
  providers: [
    UserService,
    UserOtpService,
    UserProfileService,
    UserProfileAggregatorService,
  ],
  controllers: [UsersController],
  exports: [
    UserService,
    UserOtpService,
    UserProfileService,
    UserProfileAggregatorService,
  ],
})
export class UsersModule {}
