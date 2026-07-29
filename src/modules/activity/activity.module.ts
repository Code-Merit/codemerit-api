import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Activity } from 'src/common/typeorm/entities/activity.entity';
import { MailModule } from 'src/common/mail/mail.module';
import { ActivityService } from './providers/activity/activity.service';
import { ActivityController } from './activity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Activity]), MailModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
