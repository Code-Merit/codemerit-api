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
  // Only computed when the caller passes ?subjectId= — "how much of totalPoints came from
  // this one subject," reconstructed live from QuestionAttempt (see
  // AchievementService.getUserSubjectXp). null when no subjectId was requested; a real 0 when
  // one was requested but nothing's been mastered there yet. Approximate: excludes the flat
  // quiz-completion/perfect-score bonuses (no subject attribution for those, see that method's
  // doc comment) and assumes a question's current `level` matches what it was when mastered.
  subjectXp: number | null;
}
