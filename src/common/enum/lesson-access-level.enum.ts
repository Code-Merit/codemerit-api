import { EnrollmentTierEnum, TIER_RANK } from './enrollment-tier.enum';

// Static per-lesson access gate — replaces the old daily-view-cap/ceiling model.
// A lesson unlocks for a user once their enrollment tier's rank (see TIER_RANK in
// enrollment-tier.enum.ts) is >= LESSON_ACCESS_RANK[lesson.accessLevel]. `Public` is
// the one exception: rank -1 always satisfies it, including for a logged-out visitor
// with no enrollment at all (tier === null) — this is the deliberate "share a lesson
// publicly" escape hatch. No `Serious` option exists here on purpose: Serious already
// has the highest TIER_RANK, so it automatically satisfies every accessLevel up to
// `Intern` without needing its own entry.
export enum LessonAccessLevelEnum {
  Public = 'Public',
  Basic = 'Basic',
  Curious = 'Curious',
  Pro = 'Pro',
  Intern = 'Intern',
}

export const LESSON_ACCESS_RANK: Record<LessonAccessLevelEnum, number> = {
  [LessonAccessLevelEnum.Public]: -1,
  [LessonAccessLevelEnum.Basic]: 0,
  [LessonAccessLevelEnum.Curious]: 1,
  [LessonAccessLevelEnum.Pro]: 2,
  [LessonAccessLevelEnum.Intern]: 3,
};

/** The lesson gate itself: locked unless Public, or the user's tier for the lesson's subject
 * ranks at or above its access level (`tier: null` = not enrolled). Shared by the lesson
 * service and the learning dashboard, so both decide access the same way. */
export function isLessonLocked(accessLevel: LessonAccessLevelEnum, tier: EnrollmentTierEnum | null): boolean {
  if (accessLevel === LessonAccessLevelEnum.Public) return false;
  const effectiveRank = tier === null ? -1 : TIER_RANK[tier];
  return effectiveRank < LESSON_ACCESS_RANK[accessLevel];
}
