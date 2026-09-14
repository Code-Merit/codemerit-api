import { Controller, Post } from '@nestjs/common';
import { DailyEngagementTask } from './daily-engagement.task';
//import { Public } from 'src/core/auth/decorators/public.decorator';

@Controller('admin/tasks')
export class TasksController {
  constructor(private readonly dailyEngagementTask: DailyEngagementTask) {}

  //@Public()
  @Post('trigger-engagement-cron')
  async triggerEngagementCron() {
    return await this.dailyEngagementTask.processTopPerformers();
  }
}
