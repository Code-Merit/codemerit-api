import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CERT_ACHIEVED } from 'src/common/constants/completion-thresholds';
import { BadgeAwardMethodEnum } from 'src/common/enum/badge-award-method.enum';
import { BadgeRuleMetricEnum } from 'src/common/enum/badge-rule-metric.enum';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { BadgeSourceEnum } from 'src/common/enum/badge-source.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { PermissionsService } from 'src/common/policies/permissions.service';
import {
  UserPermissionEnum,
  UserPermissionTitleEnum,
} from 'src/common/policies/user-permission.enum';
import { Badge } from 'src/common/typeorm/entities/badge.entity';
import { BadgeRule } from 'src/common/typeorm/entities/badge-rule.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserBadge } from 'src/common/typeorm/entities/user-badge.entity';
import { UserStreak } from 'src/common/typeorm/entities/user-streak.entity';
import { UserXpLog } from 'src/common/typeorm/entities/user-xp-log.entity';
import { generate6DigitNumber } from 'src/common/utils/common-functions';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { NotificationService } from 'src/modules/notification/providers/notification.service';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';
import { In, Repository } from 'typeorm';
import { BadgeExplorerBadgeDto, BadgeExplorerGroupDto, BadgeExplorerResponseDto, RelevantBadgeDto } from '../dtos/badge-explorer.dto';
import { BadgeDetailDto } from '../dtos/badge-detail.dto';
import { GrantBadgeDto } from '../dtos/grant-badge.dto';
import { BadgeQueryService } from './badge-query.service';
import { SubjectTrackAnalysisService } from '../../master/providers/subject-track-analysis.service';
import { TopicAnalysisService } from '../../master/providers/topic-analysis.service';
import {
  BADGE_CODES,
  computeLevel,
  LevelTier,
  STREAK_MILESTONES,
  XP_HINT_PENALTY_MULTIPLIER,
  XP_PER_CORRECT,
  XP_PERFECT_SCORE_BONUS,
  XP_QUIZ_COMPLETION_BONUS,
} from '../constants/gamification.constants';
import { NewlyEarnedDto } from '../dtos/newly-earned.dto';

export interface EvaluateAfterQuizAttempt {
  id: number; // the just-saved QuestionAttempt row id — used to distinguish "this
              // batch's own rows" from any prior attempts when checking whether a
              // correct answer is genuinely new (see awardXpAndLevel()).
  questionId: number;
  isCorrect: boolean;
  isSkipped: boolean;
  hintUsed: boolean;
}

export interface EvaluateAfterQuizParams {
  userId: number;
  score: number;
  attempts: EvaluateAfterQuizAttempt[];
}

/** Badges earned so far this evaluation, plus the set of codes the user already had
 * before it started — threaded through every step so each can award independently
 * without re-querying or double-awarding within the same evaluation. */
interface BadgeContext {
  alreadyEarned: Set<string>;
  badgesEarned: { code: string; name: string }[];
}

interface XpResult {
  xpAwarded: number;
  totalPoints: number;
  levelBefore: LevelTier;
  levelAfter: LevelTier;
  leveledUp: boolean;
}

interface StreakResult {
  streak: UserStreak;
  milestoneHit?: number;
}

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(Certificate)
    private readonly certificateRepo: Repository<Certificate>,
    @InjectRepository(CertificationTrack)
    private readonly certificationTrackRepo: Repository<CertificationTrack>,
    @InjectRepository(Badge)
    private readonly badgeRepo: Repository<Badge>,
    @InjectRepository(BadgeRule)
    private readonly badgeRuleRepo: Repository<BadgeRule>,
    @InjectRepository(UserBadge)
    private readonly userBadgeRepo: Repository<UserBadge>,
    @InjectRepository(UserStreak)
    private readonly userStreakRepo: Repository<UserStreak>,
    @InjectRepository(UserXpLog)
    private readonly userXpLogRepo: Repository<UserXpLog>,
    @InjectRepository(QuizResult)
    private readonly quizResultRepo: Repository<QuizResult>,
    @InjectRepository(QuestionAttempt)
    private readonly questionAttemptRepo: Repository<QuestionAttempt>,
    @InjectRepository(Subject)
    private readonly subjectRepo: Repository<Subject>,
    @InjectRepository(JobRole)
    private readonly jobRoleRepo: Repository<JobRole>,
    @InjectRepository(Topic)
    private readonly topicRepo: Repository<Topic>,
    private readonly subjectTrackAnalyzer: SubjectTrackAnalysisService,
    private readonly topicAnalyzer: TopicAnalysisService,
    private readonly notificationService: NotificationService,
    private readonly activityService: ActivityService,
    private readonly permissionsService: PermissionsService,
    private readonly badgeQueryService: BadgeQueryService,
    private readonly skillEnrollmentService: SkillEnrollmentService,
  ) {}

  /**
   * Runs every gamification consequence of a single quiz submission, in order:
   * XP/level, streak, then badges (streak milestone, first-quiz, perfect-score,
   * subject-mastered), then certification. Each step is a named method below —
   * this method is just the orchestration, not the logic itself.
   */
  async evaluateAfterQuiz(params: EvaluateAfterQuizParams): Promise<NewlyEarnedDto> {
    const { userId, score, attempts } = params;

    const badgeContext: BadgeContext = {
      alreadyEarned: new Set(
        (await this.userBadgeRepo.find({ where: { userId }, relations: ['badge'] })).map(
          (ub) => ub.badge.code,
        ),
      ),
      badgesEarned: [],
    };

    const questionIds = [...new Set(attempts.map((a) => a.questionId))];
    const questions = questionIds.length
      ? await this.questionRepo.find({ where: { id: In(questionIds) } })
      : [];

    const xp = await this.awardXpAndLevel(userId, score, attempts, questions);
    const streakResult = await this.updateStreak(userId);

    if (streakResult.milestoneHit) {
      await this.notificationService.notifyStreakMilestone(userId, streakResult.milestoneHit);
      await this.activityService.createActivity(
        userId,
        'Streak Milestone',
        `reached a ${streakResult.milestoneHit}-day streak!`,
      );
      await this.awardBadgeIfNew(userId, `streak_${streakResult.milestoneHit}`, badgeContext);
    }

    await this.evaluateFirstQuizAndPerfectScoreBadges(userId, score, badgeContext);

    const subjectIds = [...new Set(questions.map((q) => q.subjectId))];
    await this.evaluateSubjectMasteredBadge(userId, subjectIds, badgeContext);
    await this.evaluateCustomBadgeRules(userId, subjectIds, badgeContext);
    await this.evaluateSubjectCompletionActivity(userId, subjectIds);

    const certificatesEarned = await this.evaluateCertifications(userId, subjectIds);
    if (certificatesEarned.length) {
      await this.awardBadgeIfNew(userId, BADGE_CODES.CERT_EARNED, badgeContext);
    }

    return {
      xpAwarded: xp.xpAwarded,
      totalPoints: xp.totalPoints,
      level: xp.levelAfter,
      leveledUp: xp.leveledUp,
      streak: {
        current: streakResult.streak.currentStreak,
        longest: streakResult.streak.longestStreak,
        milestoneHit: streakResult.milestoneHit,
      },
      badgesEarned: badgeContext.badgesEarned,
      certificatesEarned,
    };
  }

  /**
   * XP is deduplicated per-question, forever: a question only ever pays out the
   * first time it's answered correctly (excluding this batch's own just-saved
   * attempt ids, so first-time mastery *in this submission* still counts) —
   * otherwise XP could be farmed by wrapping an already-mastered question in a
   * new quiz indefinitely (maxAttempts is enforced per quiz, not per question).
   * The flat completion/perfect-score bonuses are gated the same way: nothing new
   * learned this submission means 0 XP, full stop, closing that loophole entirely.
   */
  private async awardXpAndLevel(
    userId: number,
    score: number,
    attempts: EvaluateAfterQuizAttempt[],
    questions: Question[],
  ): Promise<XpResult> {
    const questionById = new Map(questions.map((q) => [q.id, q]));

    const correctQuestionIds = [
      ...new Set(attempts.filter((a) => a.isCorrect && !a.isSkipped).map((a) => a.questionId)),
    ];
    const thisBatchIds = attempts.map((a) => a.id);

    let alreadyMasteredQuestionIds = new Set<number>();
    if (correctQuestionIds.length) {
      const priorCorrectRows = await this.questionAttemptRepo
        .createQueryBuilder('qa')
        .select('DISTINCT qa.questionId', 'questionId')
        .where('qa.userId = :userId', { userId })
        .andWhere('qa.questionId IN (:...questionIds)', { questionIds: correctQuestionIds })
        .andWhere('qa.isCorrect = 1')
        .andWhere('qa.id NOT IN (:...thisBatchIds)', {
          thisBatchIds: thisBatchIds.length ? thisBatchIds : [0],
        })
        .getRawMany();
      alreadyMasteredQuestionIds = new Set(priorCorrectRows.map((r) => +r.questionId));
    }
    const newlyMasteredQuestionIds = correctQuestionIds.filter(
      (qid) => !alreadyMasteredQuestionIds.has(qid),
    );

    let xpAwarded = 0;
    for (const questionId of newlyMasteredQuestionIds) {
      const level = questionById.get(questionId)?.level ?? 1;
      const base = XP_PER_CORRECT[level] ?? XP_PER_CORRECT[1];
      const attempt = attempts.find((a) => a.questionId === questionId && a.isCorrect && !a.isSkipped);
      xpAwarded += Math.round(base * (attempt?.hintUsed ? XP_HINT_PENALTY_MULTIPLIER : 1));
    }
    if (newlyMasteredQuestionIds.length > 0) {
      xpAwarded += XP_QUIZ_COMPLETION_BONUS;
      if (score === 100) xpAwarded += XP_PERFECT_SCORE_BONUS;
    }

    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'points'] });
    const oldPoints = user?.points ?? 0;
    const totalPoints = oldPoints + xpAwarded;
    await this.userRepo.update(userId, { points: totalPoints });
    // Timestamped ledger entry — User.points has no history, so weekly/monthly
    // leaderboards need this to sum XP within a date range. Skip zero-XP events,
    // there's nothing to aggregate from them.
    if (xpAwarded > 0) {
      await this.userXpLogRepo.save(this.userXpLogRepo.create({ userId, xpAwarded }));
    }

    const levelBefore = computeLevel(oldPoints);
    const levelAfter = computeLevel(totalPoints);
    const leveledUp = levelAfter.level > levelBefore.level;
    if (leveledUp) {
      await this.notificationService.notifyLevelUp(userId, levelAfter.level, levelAfter.title);
      await this.activityService.createActivity(
        userId,
        'Level Up',
        `reached Level ${levelAfter.level}: ${levelAfter.title}.`,
      );
    }

    return { xpAwarded, totalPoints, levelBefore, levelAfter, leveledUp };
  }

  /** Upserts UserStreak by comparing lastActiveDate to today; same-day resubmissions
   * are a no-op (can't inflate the streak by submitting twice in one day). */
  private async updateStreak(userId: number): Promise<StreakResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = await this.userStreakRepo.findOne({ where: { userId } });
    let milestoneHit: number | undefined;

    if (!streak) {
      streak = this.userStreakRepo.create({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
      });
      await this.userStreakRepo.save(streak);
    } else {
      const last = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null;
      if (last) last.setHours(0, 0, 0, 0);
      const diffDays = last ? Math.round((today.getTime() - last.getTime()) / 86400000) : null;

      if (diffDays !== 0) {
        streak.currentStreak = diffDays === 1 ? streak.currentStreak + 1 : 1;
        streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
        streak.lastActiveDate = today;
        await this.userStreakRepo.save(streak);
        if (STREAK_MILESTONES.includes(streak.currentStreak)) {
          milestoneHit = streak.currentStreak;
        }
      }
    }

    return { streak, milestoneHit };
  }

  private async evaluateFirstQuizAndPerfectScoreBadges(
    userId: number,
    score: number,
    badgeContext: BadgeContext,
  ): Promise<void> {
    const quizResultCount = await this.quizResultRepo.count({ where: { userId } });
    if (quizResultCount === 1) await this.awardBadgeIfNew(userId, BADGE_CODES.FIRST_QUIZ, badgeContext);
    if (score === 100) await this.awardBadgeIfNew(userId, BADGE_CODES.PERFECT_SCORE, badgeContext);
  }

  /** Single global badge (not per-subject) — first subject where every trivia topic
   * reaches ≥70% correctCoverage awards it, then this check is skipped forever. */
  private async evaluateSubjectMasteredBadge(
    userId: number,
    subjectIds: number[],
    badgeContext: BadgeContext,
  ): Promise<void> {
    if (badgeContext.alreadyEarned.has(BADGE_CODES.SUBJECT_MASTERED)) return;

    for (const subjectId of subjectIds) {
      const topics = await this.topicAnalyzer.getTopicStatsBySubject(subjectId, userId);
      const trivia = topics.filter((t: any) => (+t.numTrivia || 0) > 0);
      // correctCoverage (not coverage) — mastery requires answering correctly, not
      // just attempting every question in the subject.
      if (trivia.length && trivia.every((t: any) => +t.correctCoverage >= 70)) {
        await this.awardBadgeIfNew(userId, BADGE_CODES.SUBJECT_MASTERED, badgeContext);
        return;
      }
    }
  }

  /** Fires a one-time "Subject Completed" activity the first time every trivia topic in a
   * subject reaches 100% correctCoverage. Unlike SUBJECT_MASTERED (a single global badge at a
   * 70% bar), this is per-subject and has no persisted completion flag to check, so it dedupes
   * via ActivityService.existsForData against dataType 'subject_completed' + dataId=subjectId. */
  private async evaluateSubjectCompletionActivity(
    userId: number,
    subjectIds: number[],
  ): Promise<void> {
    for (const subjectId of subjectIds) {
      const topics = await this.topicAnalyzer.getTopicStatsBySubject(subjectId, userId);
      const trivia = topics.filter((t: any) => (+t.numTrivia || 0) > 0);
      if (!trivia.length || !trivia.every((t: any) => +t.correctCoverage >= 100)) continue;

      const dataId = String(subjectId);
      if (await this.activityService.existsForData(userId, 'subject_completed', dataId)) continue;

      const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
      await this.activityService.createActivity(
        userId,
        'Subject Completed',
        `completed "${subject?.title ?? 'a subject'}".`,
        { dataId, dataType: 'subject_completed' },
      );
    }
  }

  /**
   * The v2 counterpart to the hardcoded 7: any published Badge with a BadgeRule attached (e.g.
   * "JavaScript Expert" at 90% correctCoverage) is auto-awarded the same way — via the same
   * idempotent awardBadgeIfNew() the original 7 use, so a badge with isManuallyGrantable=true AND
   * a rule is earnable by whichever path (this rule, or the grant endpoint) happens first.
   *
   * Subject-scoped rules are narrowed to subjects touched by *this* submission (cheap — costs one
   * lookup query when nothing matches). Topic-scoped rules are evaluated unconditionally every
   * submission regardless of which subject was touched — a deliberate simplification: there's no
   * cheap way to know "which subjects contain a rule-bearing topic" without joining through Topic,
   * and the set of topic-scoped badges is small/bounded, so the extra lookup is negligible. Since
   * topicAnalyzer always computes current standing (not a delta), a topic badge not evaluated on
   * the exact submission that qualifies it still fires on the next one that touches its subject.
   */
  private async evaluateCustomBadgeRules(
    userId: number,
    subjectIds: number[],
    badgeContext: BadgeContext,
  ): Promise<void> {
    const [subjectRules, topicRules] = await Promise.all([
      subjectIds.length
        ? this.badgeRuleRepo.find({
            relations: ['badge'],
            where: { badge: { scopeType: BadgeScopeEnum.SUBJECT, scopeId: In(subjectIds), isPublished: true } },
          })
        : Promise.resolve([]),
      this.badgeRuleRepo.find({
        relations: ['badge'],
        where: { badge: { scopeType: BadgeScopeEnum.TOPIC, isPublished: true } },
      }),
    ]);

    for (const rule of [...subjectRules, ...topicRules]) {
      const badge = rule.badge;
      if (badgeContext.alreadyEarned.has(badge.code)) continue;
      if (await this.isBadgeRuleSatisfied(userId, badge, rule)) {
        await this.awardBadgeIfNew(userId, badge.code, badgeContext);
      }
    }
  }

  private async isBadgeRuleSatisfied(userId: number, badge: Badge, rule: BadgeRule): Promise<boolean> {
    const progress = await this.computeRuleProgress(userId, badge, rule);
    return progress != null && progress >= rule.threshold;
  }

  /**
   * The percentage math behind isBadgeRuleSatisfied, extracted so the Badges page's Relevant tab
   * can show real "how close" progress (see achievement.controller.ts's explorer route) using the
   * exact same number that decides pass/fail at quiz-submit time — never a second, drift-prone
   * approximation. Returns null only when there's no data yet (zero attempts in scope), the same
   * case isBadgeRuleSatisfied previously folded straight into `false`.
   */
  private async computeRuleProgress(userId: number, badge: Badge, rule: BadgeRule): Promise<number | null> {
    if (rule.metric === BadgeRuleMetricEnum.SUBJECT_CORRECT_COVERAGE) {
      const topics = await this.topicAnalyzer.getTopicStatsBySubject(badge.scopeId, userId);
      const trivia = topics.filter((t: any) => (+t.numTrivia || 0) > 0);
      if (!trivia.length) return null;
      if (rule.difficultyLevel) {
        // A single overall percentage across the whole subject at this difficulty, not a
        // per-topic-every check — a "Beginner" bar shouldn't be broken by one topic having only
        // 2 Easy questions and missing 1.
        const { correct, total } = this.sumCorrectByDifficulty(trivia, rule.difficultyLevel);
        return total > 0 ? +((correct / total) * 100).toFixed(1) : null;
      }
      // No difficulty filter: every topic must individually clear the bar (same strict
      // definition subject_mastered/javascript_expert already use) — so the weakest topic is the
      // real bottleneck. Reporting its coverage as "progress" is what closeness actually means
      // here; an average across topics could read as "close" while one topic still fails outright.
      return Math.min(...trivia.map((t: any) => +t.correctCoverage || 0));
    }

    if (rule.metric === BadgeRuleMetricEnum.TOPIC_CORRECT_COVERAGE) {
      const [topic] = await this.topicAnalyzer.getTopicStatsByIds([badge.scopeId], userId);
      if (!topic || (+topic.numTrivia || 0) === 0) return null;
      if (rule.difficultyLevel) {
        const { correct, total } = this.sumCorrectByDifficulty([topic], rule.difficultyLevel);
        return total > 0 ? +((correct / total) * 100).toFixed(1) : null;
      }
      return +topic.correctCoverage || 0;
    }

    return null;
  }

  /** Sums correct/total for one difficulty level across one or more topic-stat rows (from
   * TopicAnalysisService) — numBasicTrivia/correctEasy for Easy, etc. */
  private sumCorrectByDifficulty(
    topics: any[],
    level: DifficultyLevelEnum,
  ): { correct: number; total: number } {
    const [totalKey, correctKey] =
      level === DifficultyLevelEnum.Easy
        ? ['numBasicTrivia', 'correctEasy']
        : level === DifficultyLevelEnum.Intermediate
          ? ['numIntTrivia', 'correctMedium']
          : ['numAdvTrivia', 'correctHard'];
    return topics.reduce(
      (acc, t) => ({
        correct: acc.correct + (+t[correctKey] || 0),
        total: acc.total + (+t[totalKey] || 0),
      }),
      { correct: 0, total: 0 },
    );
  }

  /**
   * Resolves candidate CertificationTracks touching the given subjects, checks each
   * one's completion via SubjectTrackAnalysisService.buildSubjectTrackMap() (the
   * same completion math the dashboards use — not re-derived here), and issues a
   * Certificate for any that cross CERT_ACHIEVED and aren't already issued.
   */
  private async evaluateCertifications(
    userId: number,
    subjectIds: number[],
  ): Promise<{ certificationTrackId: number; certificateNumber: string }[]> {
    const certificatesEarned: { certificationTrackId: number; certificateNumber: string }[] = [];
    if (!subjectIds.length) return certificatesEarned;

    const candidateCertTrackIds =
      await this.subjectTrackAnalyzer.getCertificationTrackIdsForSubjects(subjectIds);
    if (!candidateCertTrackIds.length) return certificatesEarned;

    const alreadyIssued = await this.certificateRepo.find({
      where: { userId, certificationTrackId: In(candidateCertTrackIds) },
    });
    const issuedSet = new Set(alreadyIssued.map((c) => c.certificationTrackId));
    const unissuedIds = candidateCertTrackIds.filter((id) => !issuedSet.has(id));
    if (!unissuedIds.length) return certificatesEarned;

    const hierarchyRows =
      await this.subjectTrackAnalyzer.fetchCertTrackSubjectTrackHierarchy(unissuedIds);

    const subjectTrackIdsByCert = new Map<number, Set<number>>();
    for (const row of hierarchyRows) {
      const ctId = +row.ctId;
      if (!subjectTrackIdsByCert.has(ctId)) subjectTrackIdsByCert.set(ctId, new Set());
      subjectTrackIdsByCert.get(ctId)!.add(+row.stId);
    }

    const allSubjectTrackIds = [...new Set(hierarchyRows.map((r) => +r.stId))];
    if (!allSubjectTrackIds.length) return certificatesEarned;

    const stRows = await this.subjectTrackAnalyzer.fetchSubjectTracksWithTopicsByIds(allSubjectTrackIds);
    const topicIds = [...new Set(stRows.map((r) => +r.topicId))];
    const topicStatsList = topicIds.length
      ? await this.topicAnalyzer.getTopicStatsByIds(topicIds, userId)
      : [];
    const topicStatsMap = new Map<number, any>(topicStatsList.map((t) => [t.id, t]));
    const subjectTrackMap = this.subjectTrackAnalyzer.buildSubjectTrackMap(
      stRows,
      topicStatsMap,
      { meritLists: new Map(), userRanks: new Map() },
      userId,
    );

    // Per-track override of the pass bar — NULL (the default for every track today)
    // falls back to the global CERT_ACHIEVED constant.
    const tracks = await this.certificationTrackRepo.find({ where: { id: In(unissuedIds) } });
    const thresholdMap = new Map<number, number>(
      tracks.map((t) => [t.id, t.passThreshold ?? CERT_ACHIEVED]),
    );

    for (const [certTrackId, subjectTrackIdSet] of subjectTrackIdsByCert) {
      const subjectTrackIds = [...subjectTrackIdSet];
      const total = subjectTrackIds.length;
      if (!total) continue;
      const completed = subjectTrackIds.filter((id) => subjectTrackMap.get(id)?.isCompleted).length;
      const progressPercent = (completed / total) * 100;
      const threshold = thresholdMap.get(certTrackId) ?? CERT_ACHIEVED;
      if (progressPercent < threshold) continue;

      const issued = await this.issueCertificate(userId, certTrackId, progressPercent);
      if (issued) certificatesEarned.push(issued);
    }

    return certificatesEarned;
  }

  // Cosmetic banding of the issuing score — this product has no separate tier concept beyond
  // the single CERT_ACHIEVED pass bar (see completion-thresholds.ts), so "Distinction" is just
  // a nicer way of saying "well above the bar," not a stored grade.
  private tierForScore(scorePercentage: number): string {
    return scorePercentage >= 90 ? 'Certified with Distinction' : 'Certified';
  }

  private async issueCertificate(
    userId: number,
    certificationTrackId: number,
    scorePercentage: number,
  ): Promise<{ certificationTrackId: number; certificateNumber: string } | null> {
    try {
      const track = await this.certificationTrackRepo.findOne({ where: { id: certificationTrackId } });
      const cert = await this.certificateRepo.save(
        this.certificateRepo.create({
          userId,
          certificationTrackId,
          certificateNumber: `CM-${certificationTrackId}-${generate6DigitNumber()}`,
          verificationCode: `${generate6DigitNumber()}${generate6DigitNumber()}`,
          scorePercentage: +scorePercentage.toFixed(2),
          skillName: track?.title ?? null,
          tierDisplayName: this.tierForScore(scorePercentage),
        }),
      );

      await this.notificationService.notifyCertificateIssued(
        userId,
        track?.title ?? 'Certification',
        cert.certificateNumber,
        certificationTrackId,
      );
      await this.activityService.createActivity(
        userId,
        'Certificate Earned',
        `earned the "${track?.title ?? 'Certification'}" certificate.`,
        { dataId: String(certificationTrackId), dataType: 'certification_track' },
      );

      return { certificationTrackId, certificateNumber: cert.certificateNumber };
    } catch (error) {
      // Unique(userId, certificationTrackId) race with a concurrent evaluation —
      // treat as already-issued and move on.
      this.logger.warn(
        `Certificate issuance skipped for userId=${userId}, certificationTrackId=${certificationTrackId}: ${error}`,
      );
      return null;
    }
  }

  private async awardBadgeIfNew(userId: number, code: string, badgeContext: BadgeContext): Promise<void> {
    if (badgeContext.alreadyEarned.has(code)) return;
    const badge = await this.badgeRepo.findOne({ where: { code } });
    if (!badge) return; // not seeded yet — skip silently
    if (!badge.isPublished) return; // disabled — matches the isPublished contract grantBadge() already enforces

    try {
      await this.userBadgeRepo.save(this.userBadgeRepo.create({ userId, badgeId: badge.id }));
    } catch (error) {
      // Unique(userId, badgeId) race — e.g. two concurrent quiz submissions for the same user
      // both evaluating the same subject. The row already exists either way; nothing more to do.
      this.logger.warn(`awardBadgeIfNew race for userId=${userId}, code=${code}: ${error}`);
      badgeContext.alreadyEarned.add(code);
      return;
    }
    badgeContext.alreadyEarned.add(code);
    badgeContext.badgesEarned.push({ code: badge.code, name: badge.name });

    await this.notificationService.notifyBadgeEarned(userId, badge.name, badge.id);
    await this.activityService.createActivity(
      userId,
      'Badge Earned',
      `earned the "${badge.name}" badge.`,
      { dataId: String(badge.id), dataType: 'badge' },
    );
  }

  /** A user's badge collection — earned ones (with earnedAt) plus the still-locked catalog
   * entries — optionally narrowed to one scope (e.g. only this subject's badges for a contextual
   * widget on the subject dashboard). Delegates to BadgeQueryService, which MasterModule's
   * subjectDashboard/programDetails also call directly (see badge-query.service.ts's doc comment
   * for why this lives in its own module rather than here). */
  async getUserBadges(userId: number, scopeType?: BadgeScopeEnum, scopeId?: number) {
    return this.badgeQueryService.getUserBadges(userId, scopeType, scopeId);
  }

  /**
   * getUserBadges(), gated for viewing someone else's collection: Admins can view any user's
   * badges in any scope (same bypass rule as granting). Everyone else must name a specific scope
   * (scopeType, plus scopeId for anything but Global) and hold a Badge:Grant permission matching
   * it exactly — "can preview" and "can grant" share the same trust boundary here, so this reuses
   * the identical check ensureCanGrantBadge does. Passing no scope at all would otherwise leak a
   * user's entire badge collection (every subject, every streak) to a granter whose permission
   * only covers one subject.
   */
  async getUserBadgesForViewer(
    viewer: { id: number; role: string },
    targetUserId: number,
    scopeType?: BadgeScopeEnum,
    scopeId?: number,
  ) {
    if (targetUserId !== viewer.id) {
      await this.ensureCanViewUserBadges(viewer, scopeType, scopeId);
    }
    return this.getUserBadges(targetUserId, scopeType, scopeId);
  }

  private async ensureCanViewUserBadges(
    viewer: { id: number; role: string },
    scopeType?: BadgeScopeEnum,
    scopeId?: number,
  ): Promise<void> {
    if (viewer.role === UserRoleEnum.ADMIN) return;

    if (!scopeType || (scopeType !== BadgeScopeEnum.GLOBAL && scopeId === undefined)) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        "A specific scopeType (and scopeId, unless Global) is required to view another user's badges without Admin access.",
      );
    }

    const resourceType = this.resolveGrantResourceType(scopeType);
    const resourceId = scopeType === BadgeScopeEnum.GLOBAL ? null : scopeId;

    const hasPermission = await this.permissionsService.findOneByUser(
      viewer.id,
      UserPermissionEnum.BadgeGrant,
      resourceType,
      resourceId,
    );

    if (!hasPermission) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        "You do not have permission to view this user's badges for that scope.",
      );
    }
  }

  /** The full badge catalog, optionally narrowed to one scope — used by admin/interviewer UI
   * to pick which badge to grant (e.g. all SUBJECT badges for a given subjectId). */
  async getBadgeCatalog(
    scopeType?: BadgeScopeEnum,
    scopeId?: number,
    awardMethod?: BadgeAwardMethodEnum,
    isManuallyGrantable?: boolean,
  ): Promise<Badge[]> {
    if (scopeId !== undefined && !scopeType) {
      // scopeId is a polymorphic reference (Subject.id or JobRole.id) — meaningless without
      // scopeType to say which table it points into.
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'scopeType is required when scopeId is provided.',
      );
    }
    const where: Partial<Badge> = { isPublished: true };
    if (scopeType) where.scopeType = scopeType;
    if (scopeId !== undefined) where.scopeId = scopeId;
    if (awardMethod) where.awardMethod = awardMethod;
    // The real "is this grantable" filter — awardMethod is only a display hint and isn't
    // guaranteed to correlate with isManuallyGrantable for every badge.
    if (isManuallyGrantable !== undefined) where.isManuallyGrantable = isManuallyGrantable;
    return this.badgeRepo.find({ where, relations: ['rule'], order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  // Shared by getBadgeExplorer (whole catalog) and enrichWithScopeTitles (an arbitrary badge
  // list, e.g. one user's earned set) — batch-resolves Subject/JobRole/Topic titles for
  // whatever scopeType/scopeId pairs are actually present, one query per scope type rather than
  // one per badge. No existing badge endpoint does this; every other consumer resolves titles
  // client-side via the cached master catalog, which an anonymous visitor may not have loaded.
  private async buildScopeTitleResolver(
    items: { scopeType: BadgeScopeEnum; scopeId: number | null }[],
  ): Promise<{
    resolveTitle: (item: { scopeType: BadgeScopeEnum; scopeId: number | null }) => string | null;
    // Exposed separately (not swallowed into resolveTitle) — getBadgeExplorer's "relevant"
    // computation needs a Topic's parent subjectId, not just its title, plus each Subject's
    // slug (for the frontend's "Continue in <Subject> →" CTA, /dashboard/learn/:slug).
    topicSubjectById: Map<number, number>;
    subjectSlugById: Map<number, string>;
    subjectTitleById: Map<number, string>;
  }> {
    const idsFor = (scopeType: BadgeScopeEnum) =>
      [...new Set(items.filter((d) => d.scopeType === scopeType && d.scopeId != null).map((d) => d.scopeId!))];
    const subjectIds = idsFor(BadgeScopeEnum.SUBJECT);
    const jobRoleIds = idsFor(BadgeScopeEnum.JOBROLE);
    const topicIds = idsFor(BadgeScopeEnum.TOPIC);

    const [subjects, jobRoles, topics] = await Promise.all([
      subjectIds.length ? this.subjectRepo.find({ where: { id: In(subjectIds) } }) : Promise.resolve([]),
      jobRoleIds.length ? this.jobRoleRepo.find({ where: { id: In(jobRoleIds) } }) : Promise.resolve([]),
      topicIds.length ? this.topicRepo.find({ where: { id: In(topicIds) } }) : Promise.resolve([]),
    ]);
    const subjectTitleById = new Map(subjects.map((s) => [s.id, s.title]));
    const jobRoleTitleById = new Map(jobRoles.map((j) => [j.id, j.title]));
    const topicTitleById = new Map(topics.map((t) => [t.id, t.title]));
    const topicSubjectById = new Map(topics.map((t) => [t.id, t.subjectId]));
    const subjectSlugById = new Map(subjects.map((s) => [s.id, s.slug]));

    const resolveTitle = (item: { scopeType: BadgeScopeEnum; scopeId: number | null }): string | null => {
      switch (item.scopeType) {
        case BadgeScopeEnum.SUBJECT: return subjectTitleById.get(item.scopeId!) ?? null;
        case BadgeScopeEnum.JOBROLE: return jobRoleTitleById.get(item.scopeId!) ?? null;
        case BadgeScopeEnum.TOPIC: return topicTitleById.get(item.scopeId!) ?? null;
        default: return null; // Global has no scoped title
      }
    };
    return { resolveTitle, topicSubjectById, subjectSlugById, subjectTitleById };
  }

  // Enriches an arbitrary badge list (e.g. user-profile-aggregator.service.ts's earned-badges
  // field) with a resolved scopeTitle — same title-resolution logic getBadgeExplorer uses, on a
  // caller-supplied list instead of the whole catalog.
  async enrichWithScopeTitles<T extends { scopeType: BadgeScopeEnum; scopeId: number | null }>(
    items: T[],
  ): Promise<(T & { scopeTitle: string | null })[]> {
    const { resolveTitle } = await this.buildScopeTitleResolver(items);
    return items.map((item) => ({ ...item, scopeTitle: resolveTitle(item) }));
  }

  /**
   * Anonymous-safe, single-call backing for the public Badges page — the full published catalog,
   * grouped by scope with server-resolved Subject/JobRole/Topic titles, plus `earned` and
   * `relevant` slices for `userId` (both empty when `userId` is omitted). `relevant` = not-yet-
   * unlocked badges tied to the caller's *real* enrollment via SkillEnrollmentService
   * (getSubjectTierMap/getDerivedJobRoleIds) — never UserJobRole, the aspirational wishlist that
   * caused the same class of bug in badge-grid.component.ts earlier (see
   * feedback_enrollment_authority_source).
   */
  async getBadgeExplorer(userId?: number): Promise<BadgeExplorerResponseDto> {
    const [catalog, earnedRows] = await Promise.all([
      this.badgeRepo.find({ where: { isPublished: true }, order: { sortOrder: 'ASC', id: 'ASC' } }),
      userId ? this.userBadgeRepo.find({ where: { userId } }) : Promise.resolve([]),
    ]);
    const earnedByBadgeId = new Map(earnedRows.map((ub) => [ub.badgeId, ub]));

    const toDto = (badge: Badge): BadgeExplorerBadgeDto => {
      const ub = earnedByBadgeId.get(badge.id);
      return {
        code: badge.code,
        name: badge.name,
        description: badge.description,
        iconUrl: badge.iconUrl,
        points: badge.points,
        scopeType: badge.scopeType,
        scopeId: badge.scopeId,
        sortOrder: badge.sortOrder,
        earnedAt: ub?.earnedAt ?? null,
        source: ub?.source ?? null,
        unlocked: !!ub,
      };
    };
    const dtos = catalog.map(toDto);

    const { resolveTitle, topicSubjectById, subjectSlugById, subjectTitleById } = await this.buildScopeTitleResolver(dtos);

    // Group, preserving each badge's own sortOrder within its group (catalog was already
    // fetched sortOrder-ordered) — Global first, then alphabetically by resolved title.
    const groupsByKey = new Map<string, BadgeExplorerGroupDto>();
    for (const d of dtos) {
      const key = `${d.scopeType}:${d.scopeId ?? 'null'}`;
      if (!groupsByKey.has(key)) {
        groupsByKey.set(key, { scopeType: d.scopeType, scopeId: d.scopeId, scopeTitle: resolveTitle(d), badges: [] });
      }
      groupsByKey.get(key)!.badges.push(d);
    }
    const groups = [...groupsByKey.values()].sort((a, b) => {
      if (a.scopeType === BadgeScopeEnum.GLOBAL) return -1;
      if (b.scopeType === BadgeScopeEnum.GLOBAL) return 1;
      return (a.scopeTitle ?? '').localeCompare(b.scopeTitle ?? '');
    });

    const earned = dtos.filter((d) => d.unlocked);

    let relevant: RelevantBadgeDto[] = [];
    if (userId) {
      const [subjectTierMap, derivedJobRoleIds] = await Promise.all([
        this.skillEnrollmentService.getSubjectTierMap(userId),
        this.skillEnrollmentService.getDerivedJobRoleIds(userId),
      ]);
      const enrolledSubjectIds = new Set(subjectTierMap.keys());
      const enrolledJobRoleIds = new Set(derivedJobRoleIds);
      const relevantDtos = dtos.filter((d) => {
        if (d.unlocked) return false;
        switch (d.scopeType) {
          case BadgeScopeEnum.GLOBAL: return true;
          case BadgeScopeEnum.SUBJECT: return enrolledSubjectIds.has(d.scopeId!);
          case BadgeScopeEnum.JOBROLE: return enrolledJobRoleIds.has(d.scopeId!);
          case BadgeScopeEnum.TOPIC: {
            const subjectId = topicSubjectById.get(d.scopeId!);
            return subjectId != null && enrolledSubjectIds.has(subjectId);
          }
          default: return false;
        }
      });

      // Progress is only computable for Subject/Topic-scoped badges that carry a BadgeRule
      // (Global/JobRole badges have no rule-based progress concept in this codebase) — batch the
      // rule fetch rather than one query per relevant badge.
      const badgeByCode = new Map(catalog.map((b) => [b.code, b]));
      const relevantBadgeIds = relevantDtos.map((d) => badgeByCode.get(d.code)!.id);
      const rules = relevantBadgeIds.length
        ? await this.badgeRuleRepo.find({ where: { badgeId: In(relevantBadgeIds) } })
        : [];
      const ruleByBadgeId = new Map(rules.map((r) => [r.badgeId, r]));

      relevant = await Promise.all(
        relevantDtos.map(async (d): Promise<RelevantBadgeDto> => {
          const badge = badgeByCode.get(d.code)!;
          const rule = ruleByBadgeId.get(badge.id);
          const progressPercent = rule ? await this.computeRuleProgress(userId, badge, rule) : null;
          // Both resolve to the parent SUBJECT (not the topic itself) for a Topic-scoped badge —
          // the hero CTA and "Continue in X" copy always mean "go to this subject's dashboard."
          const parentSubjectId =
            d.scopeType === BadgeScopeEnum.SUBJECT ? d.scopeId
              : d.scopeType === BadgeScopeEnum.TOPIC ? topicSubjectById.get(d.scopeId!) ?? null
              : null;
          const scopeSlug = parentSubjectId != null ? subjectSlugById.get(parentSubjectId) ?? null : null;
          const scopeTitle = parentSubjectId != null ? subjectTitleById.get(parentSubjectId) ?? null : null;
          return { ...d, progressPercent, thresholdPercent: rule?.threshold ?? null, scopeSlug, scopeTitle };
        }),
      );
    }

    return { earned, relevant, groups };
  }

  /**
   * One badge's full detail — backs the unearned-badge detail modal (thumbnail, "what you need"
   * rule sentence, progress, enrollment status). Anonymous-safe like getBadgeExplorer: rule/
   * progress/enrollment are simply null/false without a userId. Computed on-demand per badge
   * rather than folded into getBadgeExplorer's `groups` (which every visitor loads on every
   * Badges-page visit) — this only runs when a caller actually opens one badge's detail.
   */
  async getBadgeDetail(code: string, userId?: number): Promise<BadgeDetailDto> {
    const badge = await this.badgeRepo.findOne({ where: { code, isPublished: true } });
    if (!badge) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Badge "${code}" not found.`);
    }

    const [ub, rule, earnedCount] = await Promise.all([
      userId ? this.userBadgeRepo.findOne({ where: { userId, badgeId: badge.id } }) : Promise.resolve(null),
      this.badgeRuleRepo.findOne({ where: { badgeId: badge.id } }),
      this.userBadgeRepo.count({ where: { badgeId: badge.id } }),
    ]);

    const { resolveTitle, topicSubjectById, subjectSlugById } = await this.buildScopeTitleResolver([badge]);
    const scopeTitle = resolveTitle(badge);
    // Same "resolve a Topic-scoped badge to its parent SUBJECT" rule getBadgeExplorer's `relevant`
    // computation uses — the CTA/enrollment check always mean "this subject's dashboard."
    const parentSubjectId =
      badge.scopeType === BadgeScopeEnum.SUBJECT ? badge.scopeId
        : badge.scopeType === BadgeScopeEnum.TOPIC ? topicSubjectById.get(badge.scopeId!) ?? null
        : null;
    const scopeSlug = parentSubjectId != null ? subjectSlugById.get(parentSubjectId) ?? null : null;

    const progressPercent = userId && rule ? await this.computeRuleProgress(userId, badge, rule) : null;

    let isEnrolled: boolean | null = null;
    if (userId && parentSubjectId != null) {
      const subjectTierMap = await this.skillEnrollmentService.getSubjectTierMap(userId);
      isEnrolled = subjectTierMap.has(parentSubjectId);
    }

    return {
      code: badge.code,
      name: badge.name,
      description: badge.description,
      content: badge.content,
      iconUrl: badge.iconUrl,
      points: badge.points,
      scopeType: badge.scopeType,
      scopeId: badge.scopeId,
      scopeTitle,
      scopeSlug,
      earnedAt: ub?.earnedAt ?? null,
      source: ub?.source ?? null,
      unlocked: !!ub,
      metric: rule?.metric ?? null,
      threshold: rule?.threshold ?? null,
      difficultyLevel: rule?.difficultyLevel ?? null,
      progressPercent,
      isEnrolled,
      earnedCount,
    };
  }

  /**
   * Manually awards a MANUAL-method badge to a user (e.g. an interviewer granting "JavaScript
   * Expert"). Re-granting an already-earned badge updates who granted it and the note rather than
   * erroring or duplicating — UserBadge stays unique per (userId, badgeId).
   */
  async grantBadge(
    granter: { id: number; role: string },
    dto: GrantBadgeDto,
  ): Promise<{ code: string; name: string; earnedAt: Date; alreadyEarned: boolean }> {
    const badge = await this.badgeRepo.findOne({ where: { id: dto.badgeId } });
    if (!badge) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Badge with ID ${dto.badgeId} not found.`);
    }
    const learner = await this.userRepo.findOne({ where: { id: dto.userId }, select: ['id'] });
    if (!learner) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `User with ID ${dto.userId} not found.`);
    }
    if (!badge.isManuallyGrantable) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `"${badge.name}" cannot be granted manually.`,
      );
    }
    if (!badge.isPublished) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `"${badge.name}" is not currently available.`,
      );
    }

    await this.ensureCanGrantBadge(granter, badge);

    const existing = await this.userBadgeRepo.findOne({
      where: { userId: dto.userId, badgeId: dto.badgeId },
    });
    if (existing) {
      await this.userBadgeRepo.update(existing.id, {
        awardedBy: granter.id,
        source: BadgeSourceEnum.MANUAL,
        note: dto.note ?? null,
      });
      return { code: badge.code, name: badge.name, earnedAt: existing.earnedAt, alreadyEarned: true };
    }

    let userBadge: UserBadge;
    try {
      userBadge = await this.userBadgeRepo.save(
        this.userBadgeRepo.create({
          userId: dto.userId,
          badgeId: dto.badgeId,
          awardedBy: granter.id,
          source: BadgeSourceEnum.MANUAL,
          note: dto.note ?? null,
        }),
      );
    } catch (error) {
      // Unique(userId, badgeId) race with a concurrent grant — the loser here still
      // records who granted it / the note, same as the existing-row path above.
      const raced = await this.userBadgeRepo.findOne({
        where: { userId: dto.userId, badgeId: dto.badgeId },
      });
      if (!raced) throw error;
      this.logger.warn(
        `grantBadge race for userId=${dto.userId}, badgeId=${dto.badgeId}: ${error}`,
      );
      await this.userBadgeRepo.update(raced.id, {
        awardedBy: granter.id,
        source: BadgeSourceEnum.MANUAL,
        note: dto.note ?? null,
      });
      return { code: badge.code, name: badge.name, earnedAt: raced.earnedAt, alreadyEarned: true };
    }

    await this.notificationService.notifyBadgeEarned(dto.userId, badge.name, badge.id);
    await this.activityService.createActivity(
      dto.userId,
      'Badge Earned',
      `earned the "${badge.name}" badge.`,
      {
        dataId: String(badge.id),
        dataType: 'badge',
        actorId: granter.id !== dto.userId ? granter.id : undefined,
      },
    );

    return { code: badge.code, name: badge.name, earnedAt: userBadge.earnedAt, alreadyEarned: false };
  }

  /**
   * ADMIN can grant any badge. Otherwise the granter needs the `Badge:Grant` permission, scoped to
   * match the badge: SUBJECT/JOBROLE badges require a grant scoped to that exact subject/job role
   * (or a global grant with resourceId null); GLOBAL badges require a Badge-scoped grant.
   */
  private async ensureCanGrantBadge(granter: { id: number; role: string }, badge: Badge): Promise<void> {
    if (granter.role === UserRoleEnum.ADMIN) return;

    const resourceType = this.resolveGrantResourceType(badge.scopeType);
    const resourceId = badge.scopeType === BadgeScopeEnum.GLOBAL ? null : badge.scopeId;

    const hasPermission = await this.permissionsService.findOneByUser(
      granter.id,
      UserPermissionEnum.BadgeGrant,
      resourceType,
      resourceId,
    );

    if (!hasPermission) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You do not have permission to grant this badge.',
      );
    }
  }

  /** Maps a badge scopeType to the UserPermissionTitleEnum resourceType a Badge:Grant permission
   * is stored under — shared by the grant gate (ensureCanGrantBadge) and the cross-user badge-view
   * gate (ensureCanViewUserBadges), since both check the same permission for the same scope. */
  private resolveGrantResourceType(scopeType: BadgeScopeEnum): UserPermissionTitleEnum {
    return scopeType === BadgeScopeEnum.SUBJECT
      ? UserPermissionTitleEnum.Subject
      : scopeType === BadgeScopeEnum.JOBROLE
        ? UserPermissionTitleEnum.JobRole
        : scopeType === BadgeScopeEnum.TOPIC
          ? UserPermissionTitleEnum.Topic
          : UserPermissionTitleEnum.Badge;
  }
}
