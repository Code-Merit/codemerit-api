import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { BadgeRule } from 'src/common/typeorm/entities/badge-rule.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserBadge } from 'src/common/typeorm/entities/user-badge.entity';
import { UserStreak } from 'src/common/typeorm/entities/user-streak.entity';
import { UserXpLog } from 'src/common/typeorm/entities/user-xp-log.entity';
import { ActivityModule } from '../activity/activity.module';
import { MasterModule } from '../master/master.module';
import { NotificationModule } from '../notification/notification.module';
import { SkillEnrollmentModule } from '../skill-enrollment/skill-enrollment.module';
import { AchievementController } from './achievement.controller';
import { BadgeQueryModule } from './badge-query.module';
import { AchievementService } from './providers/achievement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Question,
      Certificate,
      CertificationTrack,
      Badge,
      BadgeRule,
      UserBadge,
      UserStreak,
      UserXpLog,
      QuizResult,
      QuestionAttempt,
      Subject,
      JobRole,
      Topic,
    ]),
    MasterModule,
    NotificationModule,
    ActivityModule,
    BadgeQueryModule,
    // For getBadgeExplorer()'s "relevant" computation — SkillEnrollmentService.getSubjectTierMap/
    // getDerivedJobRoleIds is the canonical real-enrollment source (same one the login response
    // already uses), never the UserJobRole wishlist. No cycle risk: SkillEnrollmentModule only
    // depends on its own entities.
    SkillEnrollmentModule,
  ],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
