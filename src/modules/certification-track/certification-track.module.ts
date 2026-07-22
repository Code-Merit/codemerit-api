import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { CertificationTrackJobRole } from 'src/common/typeorm/entities/certification-track-job-role.entity';
import { CertificationTrackSubjectTrack } from 'src/common/typeorm/entities/certification-track-subject-track.entity';
import { SubjectTrackTopic } from 'src/common/typeorm/entities/subject-track-topic.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { CertificationTrackService } from './providers/certification-track.service';
import { CertificationTrackController } from './certification-track.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CertificationTrack,
      CertificationTrackJobRole,
      CertificationTrackSubjectTrack,
      SubjectTrackTopic,
      JobRole,
    ]),
  ],
  providers: [CertificationTrackService],
  controllers: [CertificationTrackController],
  exports: [CertificationTrackService],
})
export class CertificationTrackModule {}
