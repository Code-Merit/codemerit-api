import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { MasterController } from './master.controller';
import { MasterService } from './providers/master.service';
import { RouteService } from './providers/route.service';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { UserSubject } from 'src/common/typeorm/entities/user-subject.entity';
import { TopicAnalysisService } from './providers/topic-analysis.service';
import { SubjectAnalysisService } from './providers/subject-analysis.service';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserPermission } from 'src/common/typeorm/entities/user-permission.entity';
import { UserPermissionModule } from '../user-permission/user-permission.module';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackJobRole } from 'src/common/typeorm/entities/certification-track-job-role.entity';
import { MeritService } from './providers/merit.service';
import { SubjectStatsService } from './providers/subject-stats.service';
import { ProgramService } from './providers/program.service';
import { SubjectTrackAnalysisService } from './providers/subject-track-analysis.service';
import { BadgeQueryModule } from '../achievement/badge-query.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, JobRole, UserJobRole, Subject, JobRoleSubject,
      Topic, UserSubject, UserPermission, SubjectTrack, CertificationTrack, CertificationTrackJobRole,
    ]),
    UserPermissionModule,
    BadgeQueryModule,
  ],
  controllers: [MasterController],
  providers: [
    MasterService, SubjectAnalysisService, TopicAnalysisService, RouteService,
    MeritService, SubjectStatsService, ProgramService, SubjectTrackAnalysisService,
  ],
  exports: [
    MasterService, SubjectAnalysisService, TopicAnalysisService, RouteService,
    MeritService, SubjectStatsService, ProgramService, SubjectTrackAnalysisService,
  ],
})
export class MasterModule {}
