import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPreference } from 'src/common/typeorm/entities/user-preference.entity';
import { UserPreferenceService } from './providers/user-preference.service';
import { UserPreferenceController } from './user-preference.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserPreference])],
  providers: [UserPreferenceService],
  controllers: [UserPreferenceController],
  exports: [UserPreferenceService],
})
export class UserPreferenceModule {}
