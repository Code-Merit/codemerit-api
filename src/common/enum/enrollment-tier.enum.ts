// Ladder order matters — TIER_RANK below relies on declaration order for >= comparisons.
// Basic IS persisted on a SkillEnrollment row like every other tier — it's the explicit,
// self-serve result of enrollBasic(), never an implicit default. No active row for a
// subject means "not enrolled at all" (tier: null at the service layer), not Basic.
export enum EnrollmentTierEnum {
  Basic = 'basic',
  Curious = 'curious',
  Pro = 'pro',
  Intern = 'intern',
  Serious = 'serious',
}

export const TIER_RANK: Record<EnrollmentTierEnum, number> = {
  [EnrollmentTierEnum.Basic]: 0,
  [EnrollmentTierEnum.Curious]: 1,
  [EnrollmentTierEnum.Pro]: 2,
  [EnrollmentTierEnum.Intern]: 3,
  [EnrollmentTierEnum.Serious]: 4,
};

export function isTierAtLeast(tier: EnrollmentTierEnum, min: EnrollmentTierEnum): boolean {
  return TIER_RANK[tier] >= TIER_RANK[min];
}
