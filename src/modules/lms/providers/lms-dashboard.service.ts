import { Injectable } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import { QuizSubject } from 'src/common/typeorm/entities/quiz-subject.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { QualityReview } from 'src/common/typeorm/entities/quality-review.entity';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { QualityResourceTypeEnum } from 'src/common/enum/quality-resource-type.enum';
import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';
import { computeSubjectHealthScore } from 'src/common/utils/common-functions';
import { QuestionQualityService } from './question-quality.service';

type Range = '7d' | '30d' | '90d';
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 };
const RANGE_WEEKS: Record<Range, number> = { '7d': 4, '30d': 8, '90d': 13 };

@Injectable()
export class LmsDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly questionQualityService: QuestionQualityService,
  ) {}

  // ============================================================
  // SUBJECTS DASHBOARD — one row per subject, no server-side sort/filter
  // (the Subjects/Overview tabs both derive everything from this one payload).
  // ============================================================

  async getSubjectsDashboard() {
    const [subjects, volumeMap, moderationMap, coverageMap, avgGradeMap, lessonMap, quizMap] =
      await Promise.all([
        this.dataSource.createQueryBuilder(Subject, 's').orderBy('s.title', 'ASC').getMany(),
        this.getQuestionVolumeBySubject(),
        this.questionQualityService.getModerationCountsBySubject(),
        this.questionQualityService.getReviewCoverageBySubject(),
        this.questionQualityService.getAvgGradeBySubject(),
        this.getLessonAggregateBySubject(),
        this.getQuizAggregateBySubject(),
      ]);

    return subjects.map((s) => {
      const volume = volumeMap.get(s.id) ?? { trivia: 0, general: 0, triviaActive: 0, generalActive: 0 };
      const moderation = moderationMap.get(s.id) ?? { total: 0, pending: 0, active: 0, whitelisted: 0 };
      const coverage = coverageMap.get(s.id) ?? { activeTotal: 0, unreviewed: 0, unreviewedPercent: 0 };
      const avgGrade = avgGradeMap.get(s.id) ?? null;
      const lesson = lessonMap.get(s.id) ?? { lessonCount: 0, totalViews: 0, completedCount: 0 };
      const quiz =
        quizMap.get(s.id) ?? {
          standardCount: 0,
          userQuizCount: 0,
          attemptsStd: 0,
          attemptsUQ: 0,
          avgScore: null,
          attemptsLast7d: 0,
          attemptsPrior7d: 0,
        };

      const approvalRate = moderation.total ? Math.round((moderation.active / moderation.total) * 100) : 0;
      const whitelistRate = moderation.active ? Math.round((moderation.whitelisted / moderation.active) * 100) : 0;
      const completionRate = lesson.totalViews ? Math.round((lesson.completedCount / lesson.totalViews) * 100) : 0;
      const reviewedRate = 100 - coverage.unreviewedPercent;

      const { score: healthScore } = computeSubjectHealthScore({
        approvalRate,
        whitelistRate,
        completionRate,
        reviewedRate,
      });

      const attemptsGrowthPercent =
        quiz.attemptsPrior7d > 0
          ? Math.round(((quiz.attemptsLast7d - quiz.attemptsPrior7d) / quiz.attemptsPrior7d) * 100)
          : quiz.attemptsLast7d > 0
            ? 100
            : 0;

      return {
        id: s.id,
        title: s.title,
        slug: s.slug,
        image: s.image,
        isPublished: s.isPublished,
        isPremium: s.isPremium,
        questions: {
          trivia: volume.trivia,
          general: volume.general,
          triviaActive: volume.triviaActive,
          generalActive: volume.generalActive,
          approved: moderation.active,
          pending: moderation.pending,
          whitelisted: moderation.whitelisted,
        },
        review: {
          reviewed: coverage.activeTotal - coverage.unreviewed,
          unreviewed: coverage.unreviewed,
          avgGrade,
        },
        lessons: { count: lesson.lessonCount, views: lesson.totalViews, completed: lesson.completedCount },
        quizzes: {
          standard: quiz.standardCount,
          userQuiz: quiz.userQuizCount,
          attemptsStandard: quiz.attemptsStd,
          attemptsUserQuiz: quiz.attemptsUQ,
          avgScore: quiz.avgScore,
          attemptsGrowthPercent,
        },
        healthScore,
      };
    });
  }

  private async getQuestionVolumeBySubject(): Promise<
    Map<number, { trivia: number; general: number; triviaActive: number; generalActive: number }>
  > {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('q.subjectId', 'subjectId')
      .addSelect('SUM(CASE WHEN q.questionType = :trivia THEN 1 ELSE 0 END)', 'trivia')
      .addSelect('SUM(CASE WHEN q.questionType = :general THEN 1 ELSE 0 END)', 'general')
      .addSelect('SUM(CASE WHEN q.questionType = :trivia AND q.status = :active THEN 1 ELSE 0 END)', 'triviaActive')
      .addSelect('SUM(CASE WHEN q.questionType = :general AND q.status = :active THEN 1 ELSE 0 END)', 'generalActive')
      .from(Question, 'q')
      .setParameters({
        trivia: QuestionTypeEnum.Trivia,
        general: QuestionTypeEnum.General,
        active: QuestionStatusEnum.Active,
      })
      .groupBy('q.subjectId')
      .getRawMany();

    return new Map(
      rows.map((r) => [
        Number(r.subjectId),
        {
          trivia: Number(r.trivia) || 0,
          general: Number(r.general) || 0,
          triviaActive: Number(r.triviaActive) || 0,
          generalActive: Number(r.generalActive) || 0,
        },
      ]),
    );
  }

  private async getLessonAggregateBySubject(): Promise<
    Map<number, { lessonCount: number; totalViews: number; completedCount: number }>
  > {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('l.subjectId', 'subjectId')
      .addSelect('COUNT(DISTINCT l.id)', 'lessonCount')
      .addSelect('COALESCE(SUM(ult.views), 0)', 'totalViews')
      .addSelect('SUM(CASE WHEN ult.status = :completed THEN 1 ELSE 0 END)', 'completedCount')
      .from(Lesson, 'l')
      .leftJoin(UserLessonTracker, 'ult', 'ult.lessonId = l.id')
      .setParameter('completed', UserLessonTrackerStatusEnum.Completed)
      .groupBy('l.subjectId')
      .getRawMany();

    return new Map(
      rows.map((r) => [
        Number(r.subjectId),
        {
          lessonCount: Number(r.lessonCount) || 0,
          totalViews: Number(r.totalViews) || 0,
          completedCount: Number(r.completedCount) || 0,
        },
      ]),
    );
  }

  // Also computes the two 7-day windows the frontend uses to derive "Top Movers" growth —
  // a real delta between two counts, not a fabricated daily spark series.
  private async getQuizAggregateBySubject(): Promise<
    Map<
      number,
      {
        standardCount: number;
        userQuizCount: number;
        attemptsStd: number;
        attemptsUQ: number;
        avgScore: number | null;
        attemptsLast7d: number;
        attemptsPrior7d: number;
      }
    >
  > {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const rows = await this.dataSource
      .createQueryBuilder()
      .select('qs.subjectId', 'subjectId')
      .addSelect('COUNT(DISTINCT qs.quizId)', 'standardCount')
      .addSelect('COUNT(DISTINCT qs.userQuizId)', 'userQuizCount')
      .addSelect('SUM(CASE WHEN qr.quizId IS NOT NULL THEN 1 ELSE 0 END)', 'attemptsStd')
      .addSelect('SUM(CASE WHEN qr.userQuizId IS NOT NULL THEN 1 ELSE 0 END)', 'attemptsUQ')
      .addSelect('AVG(qr.score)', 'avgScore')
      .addSelect('SUM(CASE WHEN qr.createdAt >= :sevenDaysAgo THEN 1 ELSE 0 END)', 'attemptsLast7d')
      .addSelect(
        'SUM(CASE WHEN qr.createdAt >= :fourteenDaysAgo AND qr.createdAt < :sevenDaysAgo THEN 1 ELSE 0 END)',
        'attemptsPrior7d',
      )
      .from(QuizSubject, 'qs')
      .leftJoin(QuizResult, 'qr', '(qr.quizId = qs.quizId OR qr.userQuizId = qs.userQuizId)')
      .setParameters({ sevenDaysAgo, fourteenDaysAgo })
      .groupBy('qs.subjectId')
      .getRawMany();

    return new Map(
      rows.map((r) => [
        Number(r.subjectId),
        {
          standardCount: Number(r.standardCount) || 0,
          userQuizCount: Number(r.userQuizCount) || 0,
          attemptsStd: Number(r.attemptsStd) || 0,
          attemptsUQ: Number(r.attemptsUQ) || 0,
          avgScore: r.avgScore != null ? Number(Number(r.avgScore).toFixed(1)) : null,
          attemptsLast7d: Number(r.attemptsLast7d) || 0,
          attemptsPrior7d: Number(r.attemptsPrior7d) || 0,
        },
      ]),
    );
  }

  // ============================================================
  // TRENDS — daily/weekly bucketing, same DATE()/YEAR()+WEEK() pattern as
  // AdminTrendsService, replicated locally (that service isn't exported for
  // cross-module reuse, and its generic helper can't express the subject-scoping
  // joins these series need).
  // ============================================================

  async getTrends(range: Range = '7d', subjectId?: number) {
    const days = RANGE_DAYS[range];
    const weeklyLimit = RANGE_WEEKS[range];

    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
    const startWeekDate = new Date(now);
    startWeekDate.setDate(now.getDate() - 7 * (weeklyLimit - 1));
    startWeekDate.setHours(0, 0, 0, 0);

    const questionsQb = () => {
      const qb = this.dataSource.createQueryBuilder().from(Question, 'q');
      if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });
      return qb;
    };
    const stdAttemptsQb = () => {
      const qb = this.dataSource
        .createQueryBuilder()
        .from(QuizResult, 'qr')
        .where('qr.quizType = :std', { std: QuizTypeEnum.Standard });
      if (subjectId) {
        qb.innerJoin(QuizSubject, 'qs', 'qs.quizId = qr.quizId').andWhere('qs.subjectId = :subjectId', {
          subjectId,
        });
      }
      return qb;
    };
    const uqAttemptsQb = () => {
      const qb = this.dataSource
        .createQueryBuilder()
        .from(QuizResult, 'qr')
        .where('qr.quizType = :uq', { uq: QuizTypeEnum.UserQuiz });
      if (subjectId) {
        qb.innerJoin(QuizSubject, 'qs', 'qs.userQuizId = qr.userQuizId').andWhere(
          'qs.subjectId = :subjectId',
          { subjectId },
        );
      }
      return qb;
    };
    const reviewsQb = () => {
      const qb = this.dataSource
        .createQueryBuilder()
        .from(QualityReview, 'r')
        .where('r.resourceType = :resourceType', { resourceType: QualityResourceTypeEnum.Question });
      if (subjectId) {
        qb.innerJoin(Question, 'q', 'q.id = r.resourceId').andWhere('q.subjectId = :subjectId', { subjectId });
      }
      return qb;
    };

    const [
      [questionsDaily, stdDaily, uqDaily, reviewsDaily],
      [questionsWeekly, stdWeekly, uqWeekly, reviewsWeekly],
      outcomesByWeek,
      lessonFunnel,
    ] = await Promise.all([
      Promise.all([
        this.dailyCount(questionsQb, 'q.createdAt', startDate, endDate),
        this.dailyCount(stdAttemptsQb, 'qr.createdAt', startDate, endDate),
        this.dailyCount(uqAttemptsQb, 'qr.createdAt', startDate, endDate),
        this.dailyCount(reviewsQb, 'r.createdAt', startDate, endDate),
      ]),
      Promise.all([
        this.weeklyCount(questionsQb, 'q.createdAt', startWeekDate, weeklyLimit),
        this.weeklyCount(stdAttemptsQb, 'qr.createdAt', startWeekDate, weeklyLimit),
        this.weeklyCount(uqAttemptsQb, 'qr.createdAt', startWeekDate, weeklyLimit),
        this.weeklyCount(reviewsQb, 'r.createdAt', startWeekDate, weeklyLimit),
      ]),
      this.getAttemptOutcomesByWeek(subjectId, startWeekDate, weeklyLimit),
      this.getLessonFunnel(subjectId),
    ]);

    return {
      daily: { questions: questionsDaily, standardAttempts: stdDaily, userQuizAttempts: uqDaily, reviewsSubmitted: reviewsDaily },
      weekly: { questions: questionsWeekly, standardAttempts: stdWeekly, userQuizAttempts: uqWeekly, reviewsSubmitted: reviewsWeekly },
      outcomesByWeek,
      lessonFunnel,
    };
  }

  private async dailyCount(
    qbFactory: () => SelectQueryBuilder<any>,
    dateExpr: string,
    startDate: Date,
    endDate: Date,
  ) {
    const rows = await qbFactory()
      .select(`DATE(${dateExpr})`, 'date')
      .addSelect('COUNT(*)', 'count')
      .andWhere(`${dateExpr} BETWEEN :startDate AND :endDate`, { startDate, endDate })
      .groupBy(`DATE(${dateExpr})`)
      .orderBy(`DATE(${dateExpr})`, 'ASC')
      .getRawMany();
    return rows.map((r) => ({ date: r.date, count: Number(r.count) || 0 }));
  }

  private async weeklyCount(
    qbFactory: () => SelectQueryBuilder<any>,
    dateExpr: string,
    startWeekDate: Date,
    weeklyLimit: number,
  ) {
    const rows = await qbFactory()
      .select(`YEAR(${dateExpr})`, 'year')
      .addSelect(`WEEK(${dateExpr}, 1)`, 'week')
      .addSelect('COUNT(*)', 'count')
      .andWhere(`${dateExpr} >= :startWeekDate`, { startWeekDate })
      .groupBy(`YEAR(${dateExpr})`)
      .addGroupBy(`WEEK(${dateExpr}, 1)`)
      .orderBy(`YEAR(${dateExpr})`, 'DESC')
      .addOrderBy(`WEEK(${dateExpr}, 1)`, 'DESC')
      .limit(weeklyLimit)
      .getRawMany();
    return rows
      .slice()
      .reverse()
      .map((r) => ({ week: `${r.year}-W${String(r.week).padStart(2, '0')}`, count: Number(r.count) || 0 }));
  }

  private async getAttemptOutcomesByWeek(subjectId: number | undefined, startWeekDate: Date, weeklyLimit: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('YEAR(qa.createdAt)', 'year')
      .addSelect('WEEK(qa.createdAt, 1)', 'week')
      .addSelect('SUM(CASE WHEN qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correct')
      .addSelect('SUM(CASE WHEN qa.isSkipped = 1 THEN 1 ELSE 0 END)', 'skipped')
      .addSelect('SUM(CASE WHEN qa.isCorrect = 0 AND qa.isSkipped = 0 THEN 1 ELSE 0 END)', 'wrong')
      .from(QuestionAttempt, 'qa')
      .where('qa.createdAt >= :startWeekDate', { startWeekDate });
    if (subjectId) {
      qb.innerJoin(Question, 'q', 'q.id = qa.questionId').andWhere('q.subjectId = :subjectId', { subjectId });
    }
    qb.groupBy('YEAR(qa.createdAt)')
      .addGroupBy('WEEK(qa.createdAt, 1)')
      .orderBy('YEAR(qa.createdAt)', 'DESC')
      .addOrderBy('WEEK(qa.createdAt, 1)', 'DESC')
      .limit(weeklyLimit);

    const rows = await qb.getRawMany();
    return rows
      .slice()
      .reverse()
      .map((r) => ({
        week: `${r.year}-W${String(r.week).padStart(2, '0')}`,
        correct: Number(r.correct) || 0,
        wrong: Number(r.wrong) || 0,
        skipped: Number(r.skipped) || 0,
      }));
  }

  // Snapshot, not a time series — UserLessonTracker.status is a single current state per
  // row, so "viewed" = every tracker row (a row only exists once a lesson's been opened),
  // "read" = anyone past Pending (folds in NeedsRevisit/Reported as "engaged, not Pending"),
  // "completed" = status=Completed.
  private async getLessonFunnel(subjectId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('ult.status', 'status')
      .addSelect('COUNT(ult.id)', 'count')
      .from(UserLessonTracker, 'ult');
    if (subjectId) {
      qb.innerJoin(Lesson, 'l', 'l.id = ult.lessonId').where('l.subjectId = :subjectId', { subjectId });
    }
    qb.groupBy('ult.status');

    const rows = await qb.getRawMany();
    const byStatus = new Map(rows.map((r) => [r.status, Number(r.count) || 0]));
    const total = rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0);
    const pending = byStatus.get(UserLessonTrackerStatusEnum.Pending) ?? 0;
    const completed = byStatus.get(UserLessonTrackerStatusEnum.Completed) ?? 0;

    return { viewed: total, read: total - pending, completed };
  }
}
