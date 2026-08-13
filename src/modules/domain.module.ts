import { Module } from '@nestjs/common';
import { SubjectsModule } from './subjects/subjects.module';
import { TopicsModule } from './topics/topics.module';
import { QuestionModule } from './question/question.module';
import { SkillRatingModule } from './skill-rating/skill-rating.module';
import { PermissionsModule } from './shared-module/permissions.module';
import { UserPermissionModule } from './user-permission/user-permission.module';
import { QuizModule } from './quiz/quiz.module';
import { AdminModule } from './admin/admin.module';
import { LmsModule } from './lms/lms.module';
import { NotificationModule } from './notification/notification.module';
import { InterviewModule } from './interview/interview.module';
import { LessonModule } from './lesson/lesson.module';
import { SubjectTrackModule } from './subject-track/subject-track.module';
import { CertificationTrackModule } from './certification-track/certification-track.module';
import { ActivityModule } from './activity/activity.module';
import { SkillEnrollmentModule } from './skill-enrollment/skill-enrollment.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    AdminModule,
    LmsModule,
    PermissionsModule,
    SubjectsModule,
    QuestionModule,
    TopicsModule,
    QuizModule,
    UserPermissionModule,
    SkillRatingModule,
    NotificationModule,
    ActivityModule,
    InterviewModule,
    LessonModule,
    SubjectTrackModule,
    CertificationTrackModule,
    SkillEnrollmentModule,
    PaymentModule,
  ],
})
export class DomainModule {}
