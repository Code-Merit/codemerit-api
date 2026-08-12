import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Activity } from 'src/common/typeorm/entities/activity.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { MailModule } from 'src/common/mail/mail.module';
import { ActivityService } from './providers/activity/activity.service';
import { ActivityController } from './activity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, User]), MailModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
