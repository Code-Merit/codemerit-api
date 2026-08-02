import { Injectable } from '@nestjs/common';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { DataSource } from 'typeorm';

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

  /** Leaders within one or more subjects, bucketed per subject. */
  async getSubjectMasteryLeaderboards(
    subjectIds: number[],
    userId?: number,
    limit = 10,
  ): Promise<{ meritLists: Map<number, any[]>; userRanks: Map<number, number | null> }> {
    if (!subjectIds.length) return { meritLists: new Map(), userRanks: new Map() };

    const rows = await this.dataSource
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
      .where('qa.isCorrect = 1')
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
      .where('stt.subjectTrackId IN (:...subjectTrackIds)', { subjectTrackIds })
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
      .where('qa.isCorrect = 1')
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
      .where('jrs.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
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
   * Leaderboard by XP, either all-time (User.points, unbounded) or windowed to the
   * current week/month (summed from UserXpLog, which exists only so this can be
   * computed — User.points itself has no history to slice by date). Windowing
   * makes rank achievable for new users too, instead of competing against everyone's
   * entire lifetime total forever.
   */
  async getGlobalXpLeaderboard(
    userId?: number,
    limit = 10,
    period: 'all-time' | 'weekly' | 'monthly' = 'all-time',
  ): Promise<{ leaderboard: any[]; userRank: number | null; period: string; periodStart: string | null }> {
    let rows: any[];
    let periodStart: Date | null = null;

    if (period === 'all-time') {
      rows = await this.dataSource
        .createQueryBuilder()
        .select('u.id', 'userId')
        .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
        .addSelect('u.username', 'username')
        .addSelect('u.image', 'image')
        .addSelect('u.points', 'points')
        .from('user', 'u')
        .where('u.points > 0')
        .orderBy('u.points', 'DESC')
        .getRawMany();
    } else {
      periodStart = period === 'weekly' ? this.startOfWeek() : this.startOfMonth();
      rows = await this.dataSource
        .createQueryBuilder()
        .select('u.id', 'userId')
        .addSelect("CONCAT(u.firstName, ' ', u.lastName)", 'name')
        .addSelect('u.username', 'username')
        .addSelect('u.image', 'image')
        .addSelect('SUM(xl.xpAwarded)', 'points')
        .from('user', 'u')
        .innerJoin('user_xp_log', 'xl', 'xl.userId = u.id AND xl.createdAt >= :periodStart', { periodStart })
        .groupBy('u.id')
        .orderBy('SUM(xl.xpAwarded)', 'DESC')
        .getRawMany();
    }

    // Rows are already ordered DESC by the query itself.
    const shaped = rows.map((r) => ({
      userId: +r.userId, name: r.name, username: r.username,
      image: r.image, points: +r.points || 0,
    }));
    const ranked = this.assignDenseRanks(shaped, (r) => r.points);

    return {
      leaderboard: ranked.slice(0, limit),
      userRank: userId != null ? ranked.find((r) => r.userId === userId)?.rank ?? null : null,
      period,
      periodStart: periodStart ? periodStart.toISOString() : null,
    };
  }
}
