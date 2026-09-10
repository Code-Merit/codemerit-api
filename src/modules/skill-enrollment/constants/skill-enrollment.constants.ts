import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

// Fallback daily question cap used only when EnrollmentTierCapConfig has no row for a
// tier (not yet configured by an admin). Pro/Intern/Serious are always unlimited by
// design — no entry needed. Lessons are never capped by count — see
// Lesson.accessLevel (lesson-access-level.enum.ts) for that gate instead.
export const DEFAULT_TIER_CAPS: Partial<
  Record<EnrollmentTierEnum, { dailyQuestionCap: number }>
> = {
  [EnrollmentTierEnum.Basic]: { dailyQuestionCap: 50 },
  [EnrollmentTierEnum.Curious]: { dailyQuestionCap: 120 },
};

// Fallback access-window length, in months, used when a SkillTierOffering has no
// durationMonths override for a given tier.
export const DEFAULT_TIER_DURATION_MONTHS: Record<
  Exclude<EnrollmentTierEnum, EnrollmentTierEnum.Basic>,
  number
> = {
  [EnrollmentTierEnum.Curious]: 5,
  [EnrollmentTierEnum.Pro]: 10,
  [EnrollmentTierEnum.Intern]: 20,
  // Serious is priced/billed monthly (repeatable one-time purchase, not real
  // recurring billing — see the tiered-enrollment plan for why).
  [EnrollmentTierEnum.Serious]: 1,
};
