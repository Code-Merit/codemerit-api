// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './providers/admin.service';
import { AdminPeopleService } from './providers/admin-people.service';
import { AdminContentService } from './providers/admin-content.service';
import { AdminEngagementService } from './providers/admin-engagement.service';
import { AdminAchievementsService } from './providers/admin-achievements.service';
import { AdminInterviewsService } from './providers/admin-interviews.service';
import { AdminTrendsService } from './providers/admin-trends.service';
import { User } from 'src/common/typeorm/entities/user.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { UserBadge } from 'src/common/typeorm/entities/user-badge.entity';
import { UserStreak } from 'src/common/typeorm/entities/user-streak.entity';
import { Activity } from 'src/common/typeorm/entities/activity.entity';
import { Interview } from 'src/common/typeorm/entities/interview.entity';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Subject,
      Topic,
      Question,
      QuestionAttempt,
      Quiz,
      QuizResult,
      Lesson,
      UserLessonTracker,
      JobRole,
      CertificationTrack,
      SubjectTrack,
      Certificate,
      Badge,
      UserBadge,
      UserStreak,
      Activity,
      Interview,
      AssessmentSession,
    ]),
  ],
  providers: [
    AdminService,
    AdminPeopleService,
    AdminContentService,
    AdminEngagementService,
    AdminAchievementsService,
    AdminInterviewsService,
    AdminTrendsService,
  ],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
