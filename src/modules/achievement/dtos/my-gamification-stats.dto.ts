import { LevelTier } from '../constants/gamification.constants';

export interface MyGamificationStatsStreak {
  current: number;
  longest: number;
}

// GET apis/achievements/my-stats — a persistent "what's my current standing right now"
// snapshot, distinct from NewlyEarnedDto (a one-shot delta returned only from a quiz
// submit). Same totalPoints/level/streak fields, deliberately the same shape slice, so
// a caller can merge this baseline with a fresher NewlyEarnedDto without an adapter.
export interface MyGamificationStatsDto {
  totalPoints: number;
  level: LevelTier;
  streak: MyGamificationStatsStreak | null;
}
