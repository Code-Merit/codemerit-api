import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from 'src/common/typeorm/entities/user-preference.entity';
import { DEFAULT_USER_PREFERENCES, UserPreferenceValues } from 'src/common/utils/user-preference-defaults';
import { UpdateUserPreferenceDto } from '../dtos/update-user-preference.dto';

@Injectable()
export class UserPreferenceService {
  constructor(
    @InjectRepository(UserPreference)
    private readonly repo: Repository<UserPreference>,
  ) {}

  // Read-only — never creates a row.
  async getPreferences(userId: number): Promise<UserPreferenceValues> {
    const row = await this.repo.findOne({ where: { userId } });
    return this.withDefaults(row);
  }

  // Creates the row on first use; merges onto it afterward.
  async updatePreferences(userId: number, dto: UpdateUserPreferenceDto): Promise<UserPreferenceValues> {
    let row = await this.repo.findOne({ where: { userId } });
    if (!row) {
      row = this.repo.create({ userId, ...dto });
    } else {
      Object.assign(row, dto);
    }
    const saved = await this.repo.save(row);
    return this.withDefaults(saved);
  }

  private withDefaults(row: UserPreference | null): UserPreferenceValues {
    return {
      emailAchievements: row?.emailAchievements ?? DEFAULT_USER_PREFERENCES.emailAchievements,
      emailEnrollmentConfirmations: row?.emailEnrollmentConfirmations ?? DEFAULT_USER_PREFERENCES.emailEnrollmentConfirmations,
      emailProductUpdates: row?.emailProductUpdates ?? DEFAULT_USER_PREFERENCES.emailProductUpdates,
      emailQuizReminders: row?.emailQuizReminders ?? DEFAULT_USER_PREFERENCES.emailQuizReminders,
      emailWeeklyDigest: row?.emailWeeklyDigest ?? DEFAULT_USER_PREFERENCES.emailWeeklyDigest,
      isProfilePublic: row?.isProfilePublic ?? DEFAULT_USER_PREFERENCES.isProfilePublic,
      showOnLeaderboard: row?.showOnLeaderboard ?? DEFAULT_USER_PREFERENCES.showOnLeaderboard,
      defaultLandingPage: row?.defaultLandingPage ?? DEFAULT_USER_PREFERENCES.defaultLandingPage,
      timezone: row?.timezone ?? DEFAULT_USER_PREFERENCES.timezone,
    };
  }
}
