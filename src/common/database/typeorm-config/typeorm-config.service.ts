import { Activity } from 'src/common/typeorm/entities/activity.entity';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { ApiUsage } from 'src/common/typeorm/entities/api-usage.entity';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { BadgeRule } from 'src/common/typeorm/entities/badge-rule.entity';
import { UserBadge } from 'src/common/typeorm/entities/user-badge.entity';
import { UserStreak } from 'src/common/typeorm/entities/user-streak.entity';
import { UserXpLog } from 'src/common/typeorm/entities/user-xp-log.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackJobRole } from 'src/common/typeorm/entities/certification-track-job-role.entity';
import { InterviewStatusHistory } from 'src/common/typeorm/entities/interview-status-history.entity';
import { Interview } from 'src/common/typeorm/entities/interview.entity';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { SubjectTrackTopic } from 'src/common/typeorm/entities/subject-track-topic.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { LessonSection } from 'src/common/typeorm/entities/lesson-section.entity';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { Notification } from 'src/common/typeorm/entities/notification.entity';
import { Permission } from 'src/common/typeorm/entities/permission.entity';
import { PermissionRequest } from 'src/common/typeorm/entities/permission-request.entity';
import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuizQuestion } from 'src/common/typeorm/entities/quiz-quesion.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { QuizSettings } from 'src/common/typeorm/entities/quiz-settings.entity';
import { QuizSubject } from 'src/common/typeorm/entities/quiz-subject.entity';
import { QuizTopic } from 'src/common/typeorm/entities/quiz-topic.entity';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { SkillMetric } from 'src/common/typeorm/entities/skill-metric.entity';
import { SkillRating } from 'src/common/typeorm/entities/skill-rating.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import { UserOtp } from 'src/common/typeorm/entities/user-otp.entity';
import { UserPermission } from 'src/common/typeorm/entities/user-permission.entity';
import { UserSubject } from 'src/common/typeorm/entities/user-subject.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { IDatabaseConfig } from 'src/config/database-config';
@Injectable()
export class TypeormConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const databaseConfig = this.configService.get(
      'database',
    ) as IDatabaseConfig;
    return {
      type: databaseConfig.type as 'mysql',
      host: databaseConfig.host,
      port: databaseConfig.port,
      username: databaseConfig.username,
      password: databaseConfig.password,
      database: databaseConfig.database,
      entities: [
        User,
        Profile,
        Subject,
        JobRole,
        JobRoleSubject,
        UserJobRole,
        UserSubject,
        Topic,
        UserOtp,
        Question,
        QuestionOption,
        QuestionTopic,
        AssessmentSession,
        SkillRating,
        QuestionAttempt,
        Quiz,
        QuizResult,
        QuizQuestion,
        QuizSubject,
        QuizTopic,
        QuizSettings,
        Lesson,
        LessonSection,
        UserLessonTracker,
        Permission,
        PermissionRequest,
        UserPermission,
        ApiUsage,
        Notification,
        Activity,
        SkillMetric,
        Interview,
        InterviewStatusHistory,
        CertificationTrack,
        CertificationTrackJobRole,
        SubjectTrack,
        CertificationTrackSubjectTrack,
        SubjectTrackTopic,
        Certificate,
        Badge,
        BadgeRule,
        UserBadge,
        UserStreak,
        UserXpLog,
      ],
      // entities: [__dirname + '/../**/*.entity.{ts,js}'],
      // entities: ['src/**/*.entity.ts'],
      synchronize: true,
    } as TypeOrmModuleOptions;
  }
}