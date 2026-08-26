import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { BadgeSourceEnum } from 'src/common/enum/badge-source.enum';
import { BadgeRuleMetricEnum } from 'src/common/enum/badge-rule-metric.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';

// One topic within a Subject-scoped badge's "topics covered" list (or the single topic for a
// Topic-scoped badge). `attempted` is numTrivia > 0 for the caller in that topic — reuses
// TopicAnalysisService's existing per-topic stats, not a new persisted flag. Always false for an
// anonymous caller.
export interface BadgeDetailTopicDto {
  id: number;
  title: string;
  attempted: boolean;
}

// Backs the unearned-badge detail modal — GET apis/achievements/badges/:code/detail. Everything
// beyond the plain Badge fields (metric/threshold/difficultyLevel/progressPercent/isEnrolled/
// topics) is null/empty for an anonymous caller or a badge with no BadgeRule (Global/JobRole).
export interface BadgeDetailDto {
  code: string;
  name: string;
  description: string;
  iconUrl: string;
  points: number;
  scopeType: BadgeScopeEnum;
  scopeId: number | null;
  scopeTitle: string | null;
  // Subject.slug directly, or a Topic-scoped badge's parent subject's slug — same resolution as
  // RelevantBadgeDto.scopeSlug, for the "View Subject" CTA. Null for Global/JobRole.
  scopeSlug: string | null;
  earnedAt: Date | null;
  source: BadgeSourceEnum | null;
  unlocked: boolean;
  // Null when the badge has no BadgeRule (Global/JobRole — no rule-based progress concept).
  metric: BadgeRuleMetricEnum | null;
  threshold: number | null;
  difficultyLevel: DifficultyLevelEnum | null;
  // Null when there's no rule, or the caller is anonymous, or the caller has zero attempts in
  // scope yet (see computeRuleProgress) — never read null as 0%.
  progressPercent: number | null;
  // Whether the caller is enrolled in this badge's subject (Topic-scoped resolves to its parent
  // subject). Null for Global/JobRole (no enrollment concept) or an anonymous caller.
  isEnrolled: boolean | null;
  topics: BadgeDetailTopicDto[];
  // Platform-wide count of learners who've earned this badge — a plain COUNT(*) on user_badge,
  // never learner-specific, so it's populated the same for every caller including anonymous ones
  // (matches /explorer's own "public catalog" stance).
  earnedCount: number;
}
