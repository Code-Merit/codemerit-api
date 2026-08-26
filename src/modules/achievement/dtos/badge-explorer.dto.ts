import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { BadgeSourceEnum } from 'src/common/enum/badge-source.enum';

// One badge entry within a BadgeExplorerGroupDto/`earned`/`relevant` list — same fields as
// BadgeQueryService's ScopedBadgeDto, defined separately here since the explorer's title
// resolution is achievement.service.ts-local (see getBadgeExplorer), not badge-query.service.ts.
export interface BadgeExplorerBadgeDto {
  code: string;
  name: string;
  description: string;
  iconUrl: string;
  points: number;
  scopeType: BadgeScopeEnum;
  scopeId: number | null;
  sortOrder: number;
  earnedAt: Date | null;
  source: BadgeSourceEnum | null;
  unlocked: boolean;
}

// One scope's worth of the full catalog — Global is its own group (scopeId: null, scopeTitle:
// null), everything else carries a server-resolved Subject/JobRole/Topic title so an anonymous
// visitor's browser can render "CSS badges" without ever having loaded the master catalog.
export interface BadgeExplorerGroupDto {
  scopeType: BadgeScopeEnum;
  scopeId: number | null;
  scopeTitle: string | null;
  badges: BadgeExplorerBadgeDto[];
}

// Relevant-only extension — "how close" data. Both null when the badge has no BadgeRule (Global/
// JobRole badges have no rule-based progress concept in this codebase), not just when progress
// happens to be zero — a frontend consumer must not assume 0 means "just started."
export interface RelevantBadgeDto extends BadgeExplorerBadgeDto {
  progressPercent: number | null;
  thresholdPercent: number | null;
  // Subject.slug directly, or a Topic-scoped badge's parent subject's slug — what the frontend's
  // "Continue in <Subject> →" CTA routes to (/dashboard/learn/:slug). Null for Global/JobRole.
  scopeSlug: string | null;
  // The subject's title (paired with scopeSlug) — lets the hero say "Continue in CSS" without a
  // second lookup against the master catalog. Null for Global/JobRole, same as scopeSlug.
  scopeTitle: string | null;
}

export interface BadgeExplorerResponseDto {
  // Every unlocked badge across every scope. Empty for an anonymous caller.
  earned: BadgeExplorerBadgeDto[];
  // Not-yet-unlocked badges relevant to the caller's real enrollment (Global always included;
  // Subject/JobRole/Topic only if they're actually enrolled, via SkillEnrollmentService — never
  // the aspirational UserJobRole wishlist). Empty for an anonymous caller.
  relevant: RelevantBadgeDto[];
  // The full published catalog, grouped by scope, Global first — every badge tagged `unlocked`
  // (always false for an anonymous caller).
  groups: BadgeExplorerGroupDto[];
}
