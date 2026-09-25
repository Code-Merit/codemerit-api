import { DefaultLandingPageEnum } from '../enum/default-landing-page.enum';

// Shared default values for a missing UserPreference row or a null column — used by the
// preferences API, NotificationService's email gating, the public-profile privacy check, and
// MeritService's leaderboard queries.
export const DEFAULT_USER_PREFERENCES = {
  emailAchievements: true,
  emailEnrollmentConfirmations: true,
  emailProductUpdates: true,
  emailQuizReminders: false,
  emailWeeklyDigest: false,
  isProfilePublic: true,
  showOnLeaderboard: true,
  defaultLandingPage: DefaultLandingPageEnum.AUTO,
  timezone: null as string | null,
};

export type UserPreferenceValues = typeof DEFAULT_USER_PREFERENCES;
