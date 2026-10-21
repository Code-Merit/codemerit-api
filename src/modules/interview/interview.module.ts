import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interview } from 'src/common/typeorm/entities/interview.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { InterviewStatusHistory } from 'src/common/typeorm/entities/interview-status-history.entity';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';
import { SkillRating } from 'src/common/typeorm/entities/skill-rating.entity';
import { InterviewController } from './interview.controller';
import { InterviewService } from './providers/interview.service';
import { UsersModule } from 'src/core/users/users.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Interview,
      JobRole,
      InterviewStatusHistory,
      AssessmentSession,
      SkillRating,
    ]),
    UsersModule,
    ActivityModule,
  ],
  controllers: [InterviewController],
  providers: [InterviewService],
})
export class InterviewModule {}
