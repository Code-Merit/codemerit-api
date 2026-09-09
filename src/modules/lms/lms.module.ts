// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { LmsController } from './lms.controller';
import { LmsService } from './providers/lms.service';
import { User } from 'src/common/typeorm/entities/user.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { UserPermissionModule } from '../user-permission/user-permission.module';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import { QualityMetric } from 'src/common/typeorm/entities/quality-metric.entity';
import { QualityReview } from 'src/common/typeorm/entities/quality-review.entity';
import { QualityReviewTag } from 'src/common/typeorm/entities/quality-review-tag.entity';
import { QuestionQualityService } from './providers/question-quality.service';
import { LmsDashboardService } from './providers/lms-dashboard.service';
import { LmsManagerGuard } from './guards/lms-manager.guard';

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
      QualityMetric,
      QualityReview,
      QualityReviewTag,
    ]),
    UserPermissionModule,
  ],
  providers: [LmsService, QuestionQualityService, LmsDashboardService, LmsManagerGuard],
  controllers: [LmsController],
  exports: [LmsService, QuestionQualityService, LmsDashboardService],
})
export class LmsModule {}
