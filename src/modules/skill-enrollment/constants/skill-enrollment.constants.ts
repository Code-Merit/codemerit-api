import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

// Fallback daily caps used only when EnrollmentTierCapConfig has no row for a tier
// (not yet configured by an admin). Pro/Intern/Serious are always
// unlimited by design — no entry needed.
export const DEFAULT_TIER_CAPS: Partial<
  Record<EnrollmentTierEnum, { dailyQuizCap: number; dailyLessonCap: number }>
> = {
  [EnrollmentTierEnum.Basic]: { dailyQuizCap: 10, dailyLessonCap: 3 },
  [EnrollmentTierEnum.Curious]: { dailyQuizCap: 20, dailyLessonCap: 7 },
};

// Basic-tier ceiling on premium subjects: once a user has viewed this fraction of a
// premium subject's lesson catalog (cumulative, all-time — not a daily reset), no
// further new lessons in that subject unlock until they upgrade past Basic.
export const BASIC_PREMIUM_SUBJECT_CONTENT_CEILING = 1; //no celing for now

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
