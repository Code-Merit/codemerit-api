// XP per correct, non-skipped answer, scaled by question difficulty
// (DifficultyLevelEnum: Easy=1, Intermediate=2, Advanced=3).
export const XP_PER_CORRECT: Record<number, number> = {
  1: 10,
  2: 15,
  3: 20
};

export const XP_HINT_PENALTY_MULTIPLIER = 0.5; // hintUsed halves that question's XP
export const XP_QUIZ_COMPLETION_BONUS = 5; // flat, for finishing any quiz
export const XP_PERFECT_SCORE_BONUS = 25; // score === 100

export const STREAK_MILESTONES = [7, 30, 100];

export interface LevelTier {
  level: number;
  title: string;
  minXp: number;
}

// Disjoint from getAggregateUserLevel()'s per-subject skill labels
// (Novice/Beginner/Developing/Intermediate/Proficient/Advanced) to avoid
// on-screen collisions between "topic skill level" and "account XP level".
export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, title: 'Rookie', minXp: 0 },
  { level: 2, title: 'Learner', minXp: 500 },
  { level: 3, title: 'Achiever', minXp: 1000 },
  { level: 4, title: 'Specialist', minXp: 2000 },
  { level: 5, title: 'Expert', minXp: 2500 },
  { level: 6, title: 'Champion', minXp: 4000 },
  { level: 7, title: 'Legend', minXp: 11000 }
];

export function computeLevel(points: number): LevelTier {
  let current = LEVEL_TIERS[0];
  for (const tier of LEVEL_TIERS) {
    if (points >= tier.minXp) current = tier;
    else break;
  }
  return current;
}

export const BADGE_CODES = {
  FIRST_QUIZ: 'first_quiz',
  PERFECT_SCORE: 'perfect_score',
  SUBJECT_MASTERED: 'subject_mastered',
  STREAK_7: 'streak_7',
  STREAK_30: 'streak_30',
  STREAK_100: 'streak_100',
  CERT_EARNED: 'cert_earned',
} as const;
