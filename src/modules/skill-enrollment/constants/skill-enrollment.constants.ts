import { EnrollmentTierEnum } from 'src/common/enum/enrollment-tier.enum';

// No subject is ever hardcoded free — that decision now lives per-subject on
// Subject.isPremium (admin-controlled) and per-scope on SkillTierOffering (which
// tiers a subject/job-role sells), not in source code.

// Fallback daily caps used only when EnrollmentTierCapConfig has no row for a tier
// (first boot / not yet configured by an admin). Pro/Intern/Serious are always
// unlimited by design — no entry needed.
export const DEFAULT_TIER_CAPS: Partial<
  Record<EnrollmentTierEnum, { dailyQuizCap: number; dailyLessonCap: number }>
> = {
  [EnrollmentTierEnum.Basic]: { dailyQuizCap: 4, dailyLessonCap: 3 },
  [EnrollmentTierEnum.Curious]: { dailyQuizCap: 10, dailyLessonCap: 5 },
};

// Basic-tier ceiling on premium subjects: once a user has viewed this fraction of a
// premium subject's lesson catalog (cumulative, all-time — not a daily reset), no
// further new lessons in that subject unlock until they upgrade past Basic.
export const BASIC_PREMIUM_SUBJECT_CONTENT_CEILING = 0.4;

// Fallback access-window length, in months, used when a SkillTierOffering has no
// durationMonths override for a given tier.
export const DEFAULT_TIER_DURATION_MONTHS: Record<
  Exclude<EnrollmentTierEnum, EnrollmentTierEnum.Basic>,
  number
> = {
  [EnrollmentTierEnum.Curious]: 6,
  [EnrollmentTierEnum.Pro]: 6,
  [EnrollmentTierEnum.Intern]: 6,
  // Serious is priced/billed monthly (repeatable one-time purchase, not real
  // recurring billing — see the tiered-enrollment plan for why).
  [EnrollmentTierEnum.Serious]: 1,
};
