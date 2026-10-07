import { Injectable } from '@nestjs/common';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { DataSource } from 'typeorm';
import { XP_HINT_PENALTY_MULTIPLIER, XP_PER_CORRECT } from 'src/modules/achievement/constants/gamification.constants';

@Injectable()
export class MeritService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Dense-rank a list already sorted descending by score (ties share a rank, e.g.
   * 1,1,3 not 1,1,2). The one implementation of this — was previously copy-pasted
   * three times in this file (subject merits, subject-track merits, XP leaderboard).
   */
  private assignDenseRanks<T>(
    sortedDescending: T[],
    getScore: (item: T) => number,
  ): (T & { rank: number })[] {
    let prev: number | null = null;
    let rank = 0;
    let seen = 0;
    return sortedDescending.map((item) => {
      seen++;
      const score = getScore(item);
      if (prev === null || score < prev) rank = seen;
      prev = score;
      return { ...item, rank };
    });
  }

  // ─── Mastery-based leaderboards (subject / subject-track / job-role) ─────────
  //
  // "Leader" = whoever has answered the most DISTINCT questions correctly, ever —
  // the same "first correct answer, permanent credit" philosophy already used for
  // XP (see AchievementService.awardXpAndLevel). This replaced an older formula
  // (generateScore(attempts,correct,wrong)*0.8 + coverage*0.2, based on each
  // question's *latest* attempt) that was duplicated across four separate methods
  // in this codebase — this is the one remaining implementation. Trivia/Active
  // questions only, matching the numTrivia/coverage convention used everywhere
  // else on these dashboards.

  private shapeAndRankMasteryRows(
    rows: any[],
    userId?: number,
    limit = 10,
  ): { meritList: any[]; userRank: number | null } {
    const shaped = rows
      .map((r) => ({
        userId: +r.userId, name: r.name, username: r.username,
        image: r.image, designationName: r.designationName,
        masteryCount: +r.masteryCount || 0,
      }))
      .sort((a, b) => b.masteryCount - a.masteryCount);
    const ranked = this.assignDenseRanks(shaped, (m) => m.masteryCount);
    return {
      meritList: ranked.slice(0, limit),
      userRank: userId != null ? ranked.find((m) => m.userId === userId)?.rank ?? null : null,
    };
  }

  /**
   * Leaders within one or more subjects, bucketed per subject.
   *
   * `scoreField` picks what `masteryCount` actually adds up — default `'count'` is the
   * original "one point per distinct question answered correctly" rule (still what
   * every other caller of this method gets, unchanged: program.service.ts's Job-Role
   * Course Dashboard aggregation in particular, which labels this value "correct" in
   * the frontend and must keep meaning that). `'marks'` is additive and opt-in: it sums
   * each distinctly-correctly-answered question's own authored `Question.marks` weight
   * instead of counting it as 1, so a harder/higher-value question contributes more —
   * closer in spirit to how AchievementService.awardXpAndLevel() weights real XP by
   * level, without claiming to BE that number (this stays subject-scoped and doesn't
   * include quiz-completion/perfect-score bonuses the real XP economy adds). Currently
   * only SubjectStatsService's Subject Dashboard leaderboard opts into `'marks'`.
   */
  async getSubjectMasteryLeaderboards(
    subjectIds: number[],
    userId?: number,
    limit = 10,
    scoreField: 'count' | 'marks' = 'count',
  ): Promise<{ meritLists: Map<number, any[]>; userRanks: Map<number, number | null> }> {
    if (!subjectIds.length) return { meritLists: new Map(), userRanks: new Map() };

    const rows = scoreField === 'marks'
      ? await this.dataSource
          .createQueryBuilder()
          .select('t.subjectId', 'subjectId')
          .addSelect('t.userId', 'userId')
          .addSelect('t.name', 'name')
          .addSelect('t.username', 'username')
          .addSelect('t.image', 'image')
          .addSelect('t.designationName', 'designationName')
          .addSelect('SUM(t.marks)', 'masteryCount')
          .from((subQb) => subQb
            // DISTINCT over (subjectId, userId, questionId, marks) — a question answered
            // correctly more than once (retries) still contributes its marks exactly
            // once, same "first correct answer, permanent credit" rule the count variant
            // already applies via COUNT(DISTINCT questionId).
            .select('DISTINCT q.subjectId', 'subjectId')
            .addSelect('u.id', 'userId')
            .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
            .addSelect('u.username', 'username')
            .addSelect('u.image', 'image')
            .addSelect('jr.title', 'designationName')
            .addSelect('q.id', 'questionId')
            .addSelect('q.marks', 'marks')
            .from('question_attempt', 'qa')
            .innerJoin(
              'question', 'q',
              'q.id = qa.questionId AND q.subjectId IN (:...subjectIds) AND q.status = :active AND q.questionType = :trivia',
              { subjectIds, active: QuestionStatusEnum.Active, trivia: QuestionTypeEnum.Trivia },
            )
            .innerJoin('user', 'u', 'u.id = qa.userId')
            .leftJoin('job_role', 'jr', 'jr.id = u.designation')
            // Excludes users with showOnLeaderboard = false; no row defaults to visible.
            .leftJoin('user_preference', 'up', 'up.userId = u.id')
            .where('qa.isCorrect = 1')
            .andWhere('(up.showOnLeaderboard IS NULL OR up.showOnLeaderboard = 1)'), 't')
          .groupBy('t.subjectId')
          .addGroupBy('t.userId')
          .getRawMany()
      : await this.dataSource
          .createQueryBuilder()
          .select('q.subjectId', 'subjectId')
          .addSelect('u.id', 'userId')
          .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
          .addSelect('u.username', 'username')
          .addSelect('u.image', 'image')
          .addSelect('jr.title', 'designationName')
          .addSelect('COUNT(DISTINCT qa.questionId)', 'masteryCount')
          .from('question_attempt', 'qa')
          .innerJoin(
            'question', 'q',
            'q.id = qa.questionId AND q.subjectId IN (:...subjectIds) AND q.status = :active AND q.questionType = :trivia',
            { subjectIds, active: QuestionStatusEnum.Active, trivia: QuestionTypeEnum.Trivia },
          )
          .innerJoin('user', 'u', 'u.id = qa.userId')
          .leftJoin('job_role', 'jr', 'jr.id = u.designation')
          .leftJoin('user_preference', 'up', 'up.userId = u.id')
          .where('qa.isCorrect = 1')
          .andWhere('(up.showOnLeaderboard IS NULL OR up.showOnLeaderboard = 1)')
          .groupBy('q.subjectId')
          .addGroupBy('u.id')
          .getRawMany();

    const buckets = new Map<number, any[]>();
    for (const row of rows) {
      const subjectId = +row.subjectId;
      const arr = buckets.get(subjectId) || [];
      arr.push(row);
      buckets.set(subjectId, arr);
    }

    const meritLists = new Map<number, any[]>();
    const userRanks = new Map<number, number | null>();
    for (const [subjectId, arr] of buckets) {
      const { meritList, userRank } = this.shapeAndRankMasteryRows(arr, userId, limit);
      meritLists.set(subjectId, meritList);
      userRanks.set(subjectId, userRank);
    }
    return { meritLists, userRanks };
  }

  /** Leaders within one or more subject tracks, bucketed per subject track. */
  async getSubjectTrackMasteryLeaderboards(
    subjectTrackIds: number[],
    userId?: number,
    limit = 10,
  ): Promise<{ meritLists: Map<number, any[]>; userRanks: Map<number, number | null> }> {
    if (!subjectTrackIds.length) return { meritLists: new Map(), userRanks: new Map() };

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('stt.subjectTrackId', 'subjectTrackId')
      .addSelect('u.id', 'userId')
      .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
      .addSelect('u.username', 'username')
      .addSelect('u.image', 'image')
      .addSelect('jr.title', 'designationName')
      .addSelect('COUNT(DISTINCT qa.questionId)', 'masteryCount')
      .from('subject_track_topic', 'stt')
      .innerJoin('question_topic', 'qt', 'qt.topicId = stt.topicId')
      .innerJoin('question', 'q', 'q.id = qt.questionId AND q.status = :active AND q.questionType = :trivia', {
        active: QuestionStatusEnum.Active, trivia: QuestionTypeEnum.Trivia,
      })
      .innerJoin('question_attempt', 'qa', 'qa.questionId = q.id AND qa.isCorrect = 1')
      .innerJoin('user', 'u', 'u.id = qa.userId')
      .leftJoin('job_role', 'jr', 'jr.id = u.designation')
      .leftJoin('user_preference', 'up', 'up.userId = u.id')
      .where('stt.subjectTrackId IN (:...subjectTrackIds)', { subjectTrackIds })
      .andWhere('(up.showOnLeaderboard IS NULL OR up.showOnLeaderboard = 1)')
      .groupBy('stt.subjectTrackId')
      .addGroupBy('u.id')
      .getRawMany();

    const buckets = new Map<number, any[]>();
    for (const row of rows) {
      const stId = +row.subjectTrackId;
      const arr = buckets.get(stId) || [];
      arr.push(row);
      buckets.set(stId, arr);
    }

    const meritLists = new Map<number, any[]>();
    const userRanks = new Map<number, number | null>();
    for (const [stId, arr] of buckets) {
      const { meritList, userRank } = this.shapeAndRankMasteryRows(arr, userId, limit);
      meritLists.set(stId, meritList);
      userRanks.set(stId, userRank);
    }
    return { meritLists, userRanks };
  }

  /** Leaders across an entire job role — i.e. all of its subjects combined, not bucketed. */
  async getJobRoleMasteryLeaderboard(
    subjectIds: number[],
    userId?: number,
    limit = 10,
  ): Promise<{ meritList: any[]; userRank: number | null }> {
    if (!subjectIds.length) return { meritList: [], userRank: null };

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('u.id', 'userId')
      .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
      .addSelect('u.username', 'username')
      .addSelect('u.image', 'image')
      .addSelect('jr.title', 'designationName')
      .addSelect('COUNT(DISTINCT qa.questionId)', 'masteryCount')
      .from('question_attempt', 'qa')
      .innerJoin(
        'question', 'q',
        'q.id = qa.questionId AND q.subjectId IN (:...subjectIds) AND q.status = :active AND q.questionType = :trivia',
        { subjectIds, active: QuestionStatusEnum.Active, trivia: QuestionTypeEnum.Trivia },
      )
      .innerJoin('user', 'u', 'u.id = qa.userId')
      .leftJoin('job_role', 'jr', 'jr.id = u.designation')
      .leftJoin('user_preference', 'up', 'up.userId = u.id')
      .where('qa.isCorrect = 1')
      .andWhere('(up.showOnLeaderboard IS NULL OR up.showOnLeaderboard = 1)')
      .groupBy('u.id')
      .getRawMany();

    return this.shapeAndRankMasteryRows(rows, userId, limit);
  }

  /** Bulk version of getJobRoleMasteryLeaderboard — one query bucketed by jobRoleId (via
   * job_role_subject) instead of one query per role, for dashboards showing several enrolled
   * roles at once (e.g. career dashboard). Same double-counting caveat as elsewhere: a subject
   * shared by two roles contributes to both roles' rankings independently. */
  async getJobRoleMasteryLeaderboards(
    jobRoleIds: number[],
    userId?: number,
    limit = 10,
  ): Promise<{ meritLists: Map<number, any[]>; userRanks: Map<number, number | null> }> {
    if (!jobRoleIds.length) return { meritLists: new Map(), userRanks: new Map() };

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jrs.jobRoleId', 'jobRoleId')
      .addSelect('u.id', 'userId')
      .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
      .addSelect('u.username', 'username')
      .addSelect('u.image', 'image')
      .addSelect('jr.title', 'designationName')
      .addSelect('COUNT(DISTINCT qa.questionId)', 'masteryCount')
      .from('job_role_subject', 'jrs')
      .innerJoin(
        'question', 'q',
        'q.subjectId = jrs.subjectId AND q.status = :active AND q.questionType = :trivia',
        { active: QuestionStatusEnum.Active, trivia: QuestionTypeEnum.Trivia },
      )
      .innerJoin('question_attempt', 'qa', 'qa.questionId = q.id AND qa.isCorrect = 1')
      .innerJoin('user', 'u', 'u.id = qa.userId')
      .leftJoin('job_role', 'jr', 'jr.id = u.designation')
      .leftJoin('user_preference', 'up', 'up.userId = u.id')
      .where('jrs.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
      .andWhere('(up.showOnLeaderboard IS NULL OR up.showOnLeaderboard = 1)')
      .groupBy('jrs.jobRoleId')
      .addGroupBy('u.id')
      .getRawMany();

    const buckets = new Map<number, any[]>();
    for (const row of rows) {
      const jrId = +row.jobRoleId;
      const arr = buckets.get(jrId) || [];
      arr.push(row);
      buckets.set(jrId, arr);
    }

    const meritLists = new Map<number, any[]>();
    const userRanks = new Map<number, number | null>();
    for (const jrId of jobRoleIds) {
      const { meritList, userRank } = this.shapeAndRankMasteryRows(buckets.get(jrId) ?? [], userId, limit);
      meritLists.set(jrId, meritList);
      userRanks.set(jrId, userRank);
    }
    return { meritLists, userRanks };
  }

  // ─── Popular Topics ───────────────────────────────────────────────────────────

  async getPopularTopicsBySubject(subjectIds: number[], limit = 5): Promise<Map<number, any[]>> {
    if (!subjectIds.length) return new Map();

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('t.subjectId', 'subjectId')
      .addSelect('t.id', 'id')
      .addSelect('t.title', 'title')
      .addSelect('t.slug', 'slug')
      .addSelect('t.shortDesc', 'shortDesc')
      .addSelect('t.popularity', 'popularity')
      .from('topic', 't')
      .where('t.subjectId IN (:...subjectIds)', { subjectIds })
      .andWhere('t.isPublished = 1')
      .orderBy('t.subjectId')
      .addOrderBy('t.popularity', 'DESC')
      .getRawMany();

    const result = new Map<number, any[]>();
    for (const row of rows) {
      const subjectId = +row.subjectId;
      const arr = result.get(subjectId) || [];
      if (arr.length < limit) {
        arr.push({ id: +row.id, title: row.title, slug: row.slug, shortDesc: row.shortDesc, popularity: +row.popularity });
        result.set(subjectId, arr);
      }
    }
    return result;
  }

  async getGlobalPopularTopics(limit = 10): Promise<any[]> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('t.id', 'id')
      .addSelect('t.title', 'title')
      .addSelect('t.slug', 'slug')
      .addSelect('t.subjectId', 'subjectId')
      .addSelect('s.title', 'subjectName')
      .addSelect('COUNT(qa.id)', 'totalAttempts')
      .from('topic', 't')
      .innerJoin('subject', 's', 's.id = t.subjectId')
      .innerJoin('question_topic', 'qt', 'qt.topicId = t.id')
      .innerJoin('question', 'q', 'q.id = qt.questionId')
      .innerJoin('question_attempt', 'qa', 'qa.questionId = q.id')
      .where('t.isPublished = 1')
      .groupBy('t.id')
      .orderBy('COUNT(qa.id)', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      id: +r.id, title: r.title, slug: r.slug,
      subjectId: +r.subjectId, subjectName: r.subjectName,
      totalAttempts: +r.totalAttempts,
    }));
  }

  // ─── Global XP Leaderboard ─────────────────────────────────────────────────────

  /** Most recent Monday 00:00 (local server time) — matches UserStreak's own day-boundary convention. */
  private startOfWeek(now = new Date()): Date {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    const daysSinceMonday = (date.getDay() + 6) % 7; // getDay(): 0=Sun,1=Mon,...,6=Sat
    date.setDate(date.getDate() - daysSinceMonday);
    return date;
  }

  private startOfMonth(now = new Date()): Date {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    return date;
  }

  /**
   * Leaderboard by XP, computed live from QuestionAttempt — not User.points/UserXpLog.
   *
   * Those two exist to drive the account's own XP chip/leveling and are written as a
   * non-atomic read-then-set pair with no transaction (AchievementService.awardXpAndLevel) —
   * fine for "my own running total," but a bad foundation for a *ranking* everyone is
   * compared against: a lost update or a crash mid-write permanently desyncs them with no
   * reconciliation job anywhere in the codebase. QuestionAttempt is the actual ground truth
   * everything else is derived from, so this reconstructs the same per-question XP formula
   * directly from it: for every question a user has EVER answered correctly, take only their
   * first such attempt (a question pays out once, ever, same rule awardXpAndLevel enforces
   * going forward), weight it by XP_PER_CORRECT[level] (halved if a hint was used), and sum.
   *
   * `period` filters on WHEN that first-correct attempt happened, not on raw activity —
   * mastering a question 3 weeks ago doesn't count toward this week's total just because you
   * reopened the quiz again this week. All-time has no date filter at all.
   *
   * `subjectSlug` narrows the exact same computation to one subject's questions — "Skill Wise
   * Mastery" mode. Deliberately the SAME formula as the unscoped (global) board, not the
   * separate marks/count-based getSubjectMasteryLeaderboards() below, so a learner never sees
   * two differently-computed numbers both called "XP" depending on which leaderboard they're
   * on. An unresolvable/unpublished slug is treated exactly like no slug at all — this method
   * silently falls back to the global board rather than erroring, so a bad/stale URL never
   * breaks the page, it just loses the subject scoping.
   *
   * Known, accepted gap versus the real account XP economy: this excludes the flat
   * quiz-completion (+5) and perfect-score (+25) bonuses — those are awarded per submission,
   * not per question, with no clean single-question (or even single-subject) attribution, so
   * they can't be reconstructed from attempts alone. For a ranking (relative comparison)
   * rather than an exact personal total, that's an acceptable, small, evenly-distributed gap.
   *
   * Equal-XP ties are resolved by accuracy, not an arbitrary tiebreaker: whoever got there with
   * fewer wrong attempts outranks whoever needed more tries for the same total — same spirit as
   * journeyAccuracy elsewhere in this app (correct ÷ every attempt ever, retries included, not
   * just each question's best outcome). Computed over the user's FULL attempt history (subject-
   * filtered when scoped, but never period-filtered) rather than just this window's attempts —
   * a week/month can hold too few attempts for "this week's accuracy" to mean anything, so this
   * tiebreaker asks "how accurate is this learner overall," not "how accurate were they today."
   */
  async getXpLeaderboard(
    userId?: number,
    limit = 10,
    period: 'all-time' | 'weekly' | 'monthly' = 'all-time',
    subjectSlug?: string,
  ): Promise<{
    leaderboard: any[];
    userRank: number | null;
    period: string;
    periodStart: string | null;
    subject: { id: number; title: string; slug: string } | null;
  }> {
    const subject = subjectSlug ? await this.resolveLeaderboardSubject(subjectSlug) : null;

    const periodStart: Date | null =
      period === 'weekly' ? this.startOfWeek() : period === 'monthly' ? this.startOfMonth() : null;

    // "First correct, non-skipped attempt per (userId, questionId)" — a GROUP BY + join back
    // to the row, not a per-row correlated subquery, so this scales across the whole attempts
    // table in one pass instead of one subquery execution per candidate row.
    const firstCorrectSub = this.dataSource
      .createQueryBuilder()
      .subQuery()
      .select('MIN(fc.id)', 'firstId')
      .from('question_attempt', 'fc')
      .where('fc.isCorrect = 1')
      .andWhere('fc.isSkipped = 0')
      .groupBy('fc.userId')
      .addGroupBy('fc.questionId')
      .getQuery();

    // Per-user accuracy across EVERY attempt (not just first-correct ones), same question
    // filters as the main query, subject-scoped when `subject` is set — the accuracy tiebreak
    // above. Built as its own derived table rather than a correlated subquery for the same
    // scaling reason as firstCorrectSub.
    let accuracySubBuilder = this.dataSource
      .createQueryBuilder()
      .subQuery()
      .select('qa2.userId', 'userId')
      .addSelect('SUM(CASE WHEN qa2.isCorrect = 1 THEN 1 ELSE 0 END)', 'correctCount')
      .addSelect('COUNT(*)', 'totalCount')
      .from('question_attempt', 'qa2')
      .innerJoin(
        'question', 'q2',
        'q2.id = qa2.questionId AND q2.status = :active AND q2.questionType = :trivia',
      )
      .groupBy('qa2.userId');
    if (subject) {
      accuracySubBuilder = accuracySubBuilder.andWhere('q2.subjectId = :subjectId');
    }
    const accuracySub = accuracySubBuilder.getQuery();

    const qb = this.dataSource
      .createQueryBuilder()
      .select('u.id', 'userId')
      .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
      .addSelect('u.username', 'username')
      .addSelect('u.image', 'image')
      .addSelect('u.designation', 'designation')
      .addSelect(
        `SUM(ROUND(
           (CASE q.level WHEN :easyLevel THEN :xpEasy WHEN :mediumLevel THEN :xpMedium WHEN :hardLevel THEN :xpHard ELSE :xpEasy END)
           * (CASE WHEN qa.hintUsed = 1 THEN :hintMultiplier ELSE 1 END)
         ))`,
        'points',
      )
      // COALESCE guards a theoretical 0-row join only — every user reaching this SELECT already
      // has ≥1 correct attempt in scope via firstCorrect, so accuracy.totalCount is never 0 in
      // practice.
      .addSelect('COALESCE(accuracy.correctCount / accuracy.totalCount, 0)', 'accuracyRatio')
      .from('question_attempt', 'qa')
      .innerJoin(`(${firstCorrectSub})`, 'firstCorrect', 'firstCorrect.firstId = qa.id')
      .innerJoin(
        'question', 'q',
        'q.id = qa.questionId AND q.status = :active AND q.questionType = :trivia',
        { active: QuestionStatusEnum.Active, trivia: QuestionTypeEnum.Trivia },
      )
      .innerJoin('user', 'u', 'u.id = qa.userId')
      .leftJoin(`(${accuracySub})`, 'accuracy', 'accuracy.userId = u.id')
      .leftJoin('user_preference', 'up', 'up.userId = u.id')
      .where('(up.showOnLeaderboard IS NULL OR up.showOnLeaderboard = 1)')
      .setParameters({
        easyLevel: DifficultyLevelEnum.Easy,
        mediumLevel: DifficultyLevelEnum.Intermediate,
        hardLevel: DifficultyLevelEnum.Advanced,
        xpEasy: XP_PER_CORRECT[DifficultyLevelEnum.Easy],
        xpMedium: XP_PER_CORRECT[DifficultyLevelEnum.Intermediate],
        xpHard: XP_PER_CORRECT[DifficultyLevelEnum.Advanced],
        hintMultiplier: XP_HINT_PENALTY_MULTIPLIER,
      })
      .groupBy('u.id')
      // XP first, then accuracy breaks equal-XP ties, then userId as the last-resort
      // deterministic tiebreak (so which specific user lands in which on-page slot never
      // shifts between loads even if two people are tied on both XP and accuracy).
      .orderBy('points', 'DESC')
      .addOrderBy('accuracyRatio', 'DESC')
      .addOrderBy('u.id', 'ASC');

    if (subject) {
      qb.andWhere('q.subjectId = :subjectId', { subjectId: subject.id });
    }
    if (periodStart) {
      qb.andWhere('qa.createdAt >= :periodStart', { periodStart });
    }

    const rows = await qb.getRawMany();

    const shaped = rows.map((r) => ({
      userId: +r.userId, name: r.name, username: r.username,
      image: r.image, points: +r.points || 0, designation: r.designation || null,
    }));
    const ranked = this.assignDenseRanks(shaped, (r) => r.points);

    return {
      leaderboard: ranked.slice(0, limit),
      userRank: userId != null ? ranked.find((r) => r.userId === userId)?.rank ?? null : null,
      period,
      periodStart: periodStart ? periodStart.toISOString() : null,
      subject,
    };
  }

  /** Published-subject-only slug lookup for getXpLeaderboard's "Skill Wise Mastery" scoping —
   * an unpublished or unknown slug resolves to null, which that caller treats as "no subject,
   * show the global board" rather than a 404. */
  private async resolveLeaderboardSubject(slug: string): Promise<{ id: number; title: string; slug: string } | null> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('s.id', 'id')
      .addSelect('s.title', 'title')
      .addSelect('s.slug', 'slug')
      .from('subject', 's')
      .where('s.slug = :slug', { slug })
      .andWhere('s.isPublished = :isPublished', { isPublished: 1 })
      .getRawOne();
    return row ? { id: +row.id, title: row.title, slug: row.slug } : null;
  }
}
