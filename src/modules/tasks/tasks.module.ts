import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { DailyEngagementTask } from './daily-engagement.task';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QuestionAttempt]), NotificationModule],
  controllers: [TasksController],
  providers: [DailyEngagementTask],
  exports: [DailyEngagementTask],
})
export class TasksModule {}
