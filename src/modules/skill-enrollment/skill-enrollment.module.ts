import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillEnrollment } from 'src/common/typeorm/entities/skill-enrollment.entity';
import { SkillTierOffering } from 'src/common/typeorm/entities/skill-tier-offering.entity';
import { EnrollmentTierCapConfig } from 'src/common/typeorm/entities/enrollment-tier-cap-config.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { EnrollmentBatch } from 'src/common/typeorm/entities/enrollment-batch.entity';
import { SkillEnrollmentController } from './skill-enrollment.controller';
import { SkillEnrollmentService } from './providers/skill-enrollment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SkillEnrollment,
      SkillTierOffering,
      EnrollmentTierCapConfig,
      Subject,
      JobRole,
      JobRoleSubject,
      EnrollmentBatch,
    ]),
  ],
  providers: [SkillEnrollmentService],
  controllers: [SkillEnrollmentController],
  exports: [SkillEnrollmentService],
})
export class SkillEnrollmentModule {}
