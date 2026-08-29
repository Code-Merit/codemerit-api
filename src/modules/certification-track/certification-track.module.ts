import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackJobRole } from 'src/common/typeorm/entities/certification-track-job-role.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { SubjectTrackTopic } from 'src/common/typeorm/entities/subject-track-topic.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { NotificationModule } from 'src/modules/notification/notification.module';
import { ActivityModule } from 'src/modules/activity/activity.module';
import { MasterModule } from 'src/modules/master/master.module';
import { SkillEnrollmentModule } from 'src/modules/skill-enrollment/skill-enrollment.module';
import { CertificationTrackService } from './providers/certification-track.service';
import { CertificateService } from './providers/certificate.service';
import { CertificationTrackController } from './certification-track.controller';
import { CertificateController } from './certificate.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CertificationTrack,
      CertificationTrackJobRole,
      CertificationTrackSubjectTrack,
      SubjectTrack,
      SubjectTrackTopic,
      JobRole,
      Certificate,
      User,
      Subject,
    ]),
    NotificationModule,
    ActivityModule,
    // For CertificateService.getExplorer(): SubjectTrackAnalysisService/TopicAnalysisService
    // (MasterModule) compute per-track progress, SkillEnrollmentService (SkillEnrollmentModule)
    // gates the earned/inProgress slices to real enrollment — same source
    // feedback_enrollment_authority_source already requires for badges' "relevant" tab.
    MasterModule,
    SkillEnrollmentModule,
  ],
  providers: [CertificationTrackService, CertificateService],
  controllers: [CertificationTrackController, CertificateController],
  exports: [CertificationTrackService, CertificateService],
})
export class CertificationTrackModule {}
