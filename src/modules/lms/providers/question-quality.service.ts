import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { QualityMetric } from 'src/common/typeorm/entities/quality-metric.entity';
import { QualityReview } from 'src/common/typeorm/entities/quality-review.entity';
import { QualityReviewTag } from 'src/common/typeorm/entities/quality-review-tag.entity';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { QualityResourceTypeEnum } from 'src/common/enum/quality-resource-type.enum';
import { QualityMetricPolarityEnum } from 'src/common/enum/quality-metric-polarity.enum';
import { QualityMetricSeverityEnum } from 'src/common/enum/quality-metric-severity.enum';
import { QualityReviewOutcomeEnum } from 'src/common/enum/quality-review-outcome.enum';

// Advisory-only — a Severe tag suggests the grade shouldn't be above ~3, Medium ~6,
// Minor ~9. Never enforced/clamped; a mismatch is just recorded for later review.
const GRADE_CAP_BY_SEVERITY: Record<QualityMetricSeverityEnum, number> = {
  [QualityMetricSeverityEnum.Severe]: 3,
  [QualityMetricSeverityEnum.Medium]: 6,
  [QualityMetricSeverityEnum.Minor]: 9,
};
const SEVERITY_RANK: Record<QualityMetricSeverityEnum, number> = {
  [QualityMetricSeverityEnum.Severe]: 3,
  [QualityMetricSeverityEnum.Medium]: 2,
  [QualityMetricSeverityEnum.Minor]: 1,
};
const MIN_ATTEMPT_SAMPLE = 10;
const TOO_HARD_THRESHOLD = 0.15;
const TOO_EASY_THRESHOLD = 0.95;
const CONFUSING_THRESHOLD = 0.3;

export interface SubmitQualityReviewInput {
  outcome: QualityReviewOutcomeEnum;
  grade?: number | null;
  comment?: string | null;
  tagIds?: number[];
}

@Injectable()
export class QuestionQualityService {
  constructor(private readonly dataSource: DataSource) {}

  // `resourceType` defaults to Question — the only caller today (the Quality Review
  // dialog) never passes it, so this stays a no-op change until Lesson-scoped tags
  // are actually seeded. `applicableResourceTypes` is a `simple-json` TEXT column
  // (not a native JSON column), so this is a LIKE match on the serialized array
  // rather than JSON_CONTAINS — safe here since 'Question'/'Lesson' never collide
  // as substrings of each other.
  async listQualityMetrics(
    questionType?: QuestionTypeEnum,
    resourceType: QualityResourceTypeEnum = QualityResourceTypeEnum.Question,
  ): Promise<QualityMetric[]> {
    const qb = this.dataSource
      .createQueryBuilder(QualityMetric, 'm')
      .where('m.isActive = :active', { active: true })
      .andWhere('m.applicableResourceTypes LIKE :resourceType', { resourceType: `%"${resourceType}"%` })
      .orderBy('m.orderIndex', 'ASC');

    if (questionType) {
      qb.andWhere('(m.questionTypeScope IS NULL OR m.questionTypeScope = :qt)', {
        qt: questionType,
      });
    }
    return qb.getMany();
  }

  async getReviewHistory(
    resourceType: QualityResourceTypeEnum,
    resourceId: number,
  ): Promise<QualityReview[]> {
    return this.dataSource.getRepository(QualityReview).find({
      where: { resourceType, resourceId },
      relations: { reviewer: true, tags: { qualityMetric: true } },
      order: { createdAt: 'DESC' },
    });
  }

  // Always inserts a new, final review row — there is no draft/in-progress state, so
  // every call here is a genuine SME decision (Approve or Reject) becoming a permanent
  // part of the audit trail. Computes the advisory grade-cap/mismatch transiently (never
  // persisted — nothing reads it back after this response) and, for Question reviews,
  // rolls the result up onto Question (reviewCount/lastReviewedAt/latestGrade/
  // lastReviewOutcome) plus the Approve/Reject moderation-status nudge, in one transaction.
  async submitReview(
    resourceType: QualityResourceTypeEnum,
    resourceId: number,
    reviewerId: number,
    input: SubmitQualityReviewInput,
  ): Promise<{ review: QualityReview; suggestedGradeCap: number | null; mismatch: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const reviewRepo = manager.getRepository(QualityReview);
      const tagRepo = manager.getRepository(QualityReviewTag);
      const metricRepo = manager.getRepository(QualityMetric);

      let review = reviewRepo.create({
        resourceType,
        resourceId,
        reviewerId,
        grade: input.grade ?? null,
        outcome: input.outcome,
        comment: input.comment ?? null,
      });
      review = await reviewRepo.save(review);

      const tagIds = input.tagIds ?? [];
      const metrics = tagIds.length ? await metricRepo.findBy({ id: In(tagIds) }) : [];
      if (metrics.length) {
        await tagRepo.save(
          metrics.map((m) => tagRepo.create({ qualityReviewId: review.id, qualityMetricId: m.id })),
        );
      }
      const worst = metrics.reduce<QualityMetricSeverityEnum | null>((acc, m) => {
        if (!m.severity) return acc;
        if (!acc || SEVERITY_RANK[m.severity] > SEVERITY_RANK[acc]) return m.severity;
        return acc;
      }, null);
      const suggestedGradeCap = worst ? GRADE_CAP_BY_SEVERITY[worst] : null;
      const mismatch = review.grade != null && suggestedGradeCap != null && review.grade > suggestedGradeCap;

      // Rollup + moderation-status nudge only apply to Question today — Lesson has no
      // equivalent rollup columns yet (same resourceType gate listQualityMetrics uses).
      if (resourceType === QualityResourceTypeEnum.Question) {
        const updateSet: Record<string, unknown> = {
          reviewCount: () => '`reviewCount` + 1',
          lastReviewedAt: review.createdAt,
          latestGrade: review.grade,
          lastReviewOutcome: review.outcome,
        };

        // SME approval/rejection nudges moderation status — an Approve promotes a
        // question waiting for its first review into rotation, a Reject pulls a live
        // one back out. Anything already Inactive (or Active-and-approved,
        // Pending-and-rejected) is left alone — this only ever moves status one way
        // per outcome, never the reverse or through Inactive. A CASE on the row's
        // *current* status keeps this one atomic update instead of a separate
        // read-then-write with a race window.
        if (review.outcome === QualityReviewOutcomeEnum.Approved) {
          updateSet.status = () =>
            `CASE WHEN \`status\` = '${QuestionStatusEnum.Pending}' THEN '${QuestionStatusEnum.Active}' ELSE \`status\` END`;
        } else if (review.outcome === QualityReviewOutcomeEnum.Rejected) {
          updateSet.status = () =>
            `CASE WHEN \`status\` = '${QuestionStatusEnum.Active}' THEN '${QuestionStatusEnum.Pending}' ELSE \`status\` END`;
        }

        await manager
          .createQueryBuilder()
          .update(Question)
          .set(updateSet)
          .where('id = :resourceId', { resourceId })
          .execute();
      }

      return { review, suggestedGradeCap, mismatch };
    });
  }

  async getQualityPipelineSummary(subjectId?: number) {
    const [
      moderation,
      coverage,
      gradeDistribution,
      flaggedForRevision,
      topIssueTags,
      neverAttempted,
      outliers,
    ] = await Promise.all([
      this.getModerationCounts(subjectId),
      this.getReviewCoverage(subjectId),
      this.getGradeDistribution(subjectId),
      this.getFlaggedForRevision(subjectId),
      this.getTopIssueTags(subjectId),
      this.getNeverAttempted(subjectId),
      this.getAttemptOutliers(subjectId),
    ]);

    return {
      moderation,
      coverage,
      gradeDistribution,
      flaggedForRevision,
      topIssueTags,
      neverAttempted: { count: neverAttempted.length, sample: neverAttempted.slice(0, 20) },
      outliers,
    };
  }

  // -- grouped-by-subject variants, for the Subjects dashboard (avoids N+1 across ~50 subjects) --

  async getModerationCountsBySubject(): Promise<
    Map<number, { total: number; pending: number; active: number; whitelisted: number }>
  > {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('q.subjectId', 'subjectId')
      .addSelect('COUNT(q.id)', 'total')
      .addSelect('SUM(CASE WHEN q.status = :pending THEN 1 ELSE 0 END)', 'pending')
      .addSelect('SUM(CASE WHEN q.status = :active THEN 1 ELSE 0 END)', 'active')
      .addSelect(
        'SUM(CASE WHEN q.status = :active AND q.isWhitelisted = 1 THEN 1 ELSE 0 END)',
        'whitelisted',
      )
      .from(Question, 'q')
      .setParameters({ pending: QuestionStatusEnum.Pending, active: QuestionStatusEnum.Active })
      .groupBy('q.subjectId')
      .getRawMany();

    return new Map(
      rows.map((r) => [
        Number(r.subjectId),
        {
          total: Number(r.total) || 0,
          pending: Number(r.pending) || 0,
          active: Number(r.active) || 0,
          whitelisted: Number(r.whitelisted) || 0,
        },
      ]),
    );
  }

  async getReviewCoverageBySubject(): Promise<
    Map<number, { activeTotal: number; unreviewed: number; unreviewedPercent: number }>
  > {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('q.subjectId', 'subjectId')
      .addSelect('COUNT(q.id)', 'activeTotal')
      .addSelect('SUM(CASE WHEN q.reviewCount = 0 THEN 1 ELSE 0 END)', 'unreviewed')
      .from(Question, 'q')
      .where('q.status = :active', { active: QuestionStatusEnum.Active })
      .groupBy('q.subjectId')
      .getRawMany();

    return new Map(
      rows.map((r) => {
        const activeTotal = Number(r.activeTotal) || 0;
        const unreviewed = Number(r.unreviewed) || 0;
        return [
          Number(r.subjectId),
          { activeTotal, unreviewed, unreviewedPercent: activeTotal ? Math.round((unreviewed / activeTotal) * 100) : 0 },
        ];
      }),
    );
  }

  async getAvgGradeBySubject(): Promise<Map<number, number>> {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('q.subjectId', 'subjectId')
      .addSelect('AVG(q.latestGrade)', 'avgGrade')
      .from(Question, 'q')
      .where('q.latestGrade IS NOT NULL')
      .groupBy('q.subjectId')
      .getRawMany();

    return new Map(rows.map((r) => [Number(r.subjectId), Number(Number(r.avgGrade).toFixed(1))]));
  }

  // ============================================================
  // SME REVIEW QUEUE — deliberately cross-author. GET /apis/question (the
  // content-authoring list) forcibly scopes non-Admin callers to their own
  // createdBy — correct for that page, wrong for this one. Quality review only
  // makes sense across every author, so these two reads bypass that scoping
  // entirely and rely on the same LmsManager gate every other method here uses.
  // ============================================================

  async getReviewQueue(filters: {
    subjectSlug?: string;
    status?: 'unreviewed' | 'flagged' | 'all';
    questionType?: QuestionTypeEnum;
    limit?: number;
  }): Promise<
    {
      id: number;
      question: string;
      questionType: QuestionTypeEnum;
      subjectId: number;
      subjectTitle: string | null;
      level: number;
      reviewCount: number;
      latestGrade: number | null;
      lastReviewOutcome: QualityReviewOutcomeEnum | null;
      lastReviewedAt: Date | null;
    }[]
  > {
    const status = filters.status ?? 'all';
    const limit = filters.limit ?? 100;

    let resolvedSubjectId: number | undefined;
    if (filters.subjectSlug) {
      const subject = await this.dataSource
        .getRepository(Subject)
        .findOne({ where: { slug: filters.subjectSlug }, select: ['id'] });
      if (!subject) {
        throw new AppCustomException(
          HttpStatus.NOT_FOUND,
          `No subject found for slug "${filters.subjectSlug}".`,
        );
      }
      resolvedSubjectId = subject.id;
    }

    const qb = this.dataSource
      .createQueryBuilder()
      .select('q.id', 'id')
      .addSelect('q.question', 'question')
      .addSelect('q.questionType', 'questionType')
      .addSelect('q.subjectId', 'subjectId')
      .addSelect('s.title', 'subjectTitle')
      .addSelect('q.level', 'level')
      .addSelect('q.reviewCount', 'reviewCount')
      .addSelect('q.latestGrade', 'latestGrade')
      .addSelect('q.lastReviewOutcome', 'lastReviewOutcome')
      .addSelect('q.lastReviewedAt', 'lastReviewedAt')
      .from(Question, 'q')
      .leftJoin(Subject, 's', 's.id = q.subjectId')
      .where('q.status = :active', { active: QuestionStatusEnum.Active });

    if (resolvedSubjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId: resolvedSubjectId });
    if (filters.questionType) qb.andWhere('q.questionType = :questionType', { questionType: filters.questionType });
    if (status === 'unreviewed') qb.andWhere('q.reviewCount = 0');
    if (status === 'flagged') {
      qb.andWhere('q.lastReviewOutcome IN (:...outcomes)', {
        outcomes: [QualityReviewOutcomeEnum.NeedsRevision, QualityReviewOutcomeEnum.Rejected],
      });
    }

    qb.orderBy('q.reviewCount', 'ASC').addOrderBy('q.createdAt', 'ASC').limit(limit);

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      id: Number(r.id),
      question: r.question,
      questionType: r.questionType,
      subjectId: Number(r.subjectId),
      subjectTitle: r.subjectTitle,
      level: Number(r.level),
      reviewCount: Number(r.reviewCount) || 0,
      latestGrade: r.latestGrade !== null ? Number(r.latestGrade) : null,
      lastReviewOutcome: r.lastReviewOutcome,
      lastReviewedAt: r.lastReviewedAt,
    }));
  }

  async getQuestionReviewDetail(questionId: number): Promise<{
    id: number;
    question: string;
    hint: string | null;
    answer: string | null;
    questionType: QuestionTypeEnum;
    level: number;
    marks: number;
    subjectId: number;
    subjectTitle: string | null;
    topics: string[];
    options: { id: number; option: string; correct: boolean; comment: string | null }[];
    reviewCount: number;
    latestGrade: number | null;
    lastReviewOutcome: QualityReviewOutcomeEnum | null;
    lastReviewedAt: Date | null;
  } | null> {
    const question = await this.dataSource.getRepository(Question).findOne({
      where: { id: questionId },
      relations: { options: true, subject: true, questionTopics: { topic: true } },
    });
    if (!question) return null;

    return {
      id: question.id,
      question: question.question,
      hint: question.hint,
      answer: question.answer,
      questionType: question.questionType,
      level: question.level,
      marks: question.marks,
      subjectId: question.subjectId,
      subjectTitle: question.subject?.title ?? null,
      topics: (question.questionTopics ?? []).map((qt) => qt.topic?.title).filter((t): t is string => !!t),
      options: (question.options ?? []).map((o) => ({
        id: o.id,
        option: o.option,
        correct: o.correct,
        comment: o.comment,
      })),
      reviewCount: question.reviewCount,
      latestGrade: question.latestGrade,
      lastReviewOutcome: question.lastReviewOutcome,
      lastReviewedAt: question.lastReviewedAt,
    };
  }

  // -- existing-data widgets (Question.status/isWhitelisted) --------------------------

  private async getModerationCounts(subjectId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(q.id)', 'total')
      .addSelect('SUM(CASE WHEN q.status = :pending THEN 1 ELSE 0 END)', 'pending')
      .addSelect('SUM(CASE WHEN q.status = :active THEN 1 ELSE 0 END)', 'active')
      .addSelect(
        'SUM(CASE WHEN q.status = :active AND q.isWhitelisted = 1 THEN 1 ELSE 0 END)',
        'whitelisted',
      )
      .from(Question, 'q')
      .setParameters({ pending: QuestionStatusEnum.Pending, active: QuestionStatusEnum.Active });
    if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });

    const raw = await qb.getRawOne();
    return {
      total: Number(raw?.total) || 0,
      pending: Number(raw?.pending) || 0,
      active: Number(raw?.active) || 0,
      whitelisted: Number(raw?.whitelisted) || 0,
    };
  }

  // -- new SME review-schema widgets ---------------------------------------------------

  private async getReviewCoverage(subjectId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(q.id)', 'activeTotal')
      .addSelect('SUM(CASE WHEN q.reviewCount = 0 THEN 1 ELSE 0 END)', 'unreviewed')
      .from(Question, 'q')
      .where('q.status = :active', { active: QuestionStatusEnum.Active });
    if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });

    const raw = await qb.getRawOne();
    const activeTotal = Number(raw?.activeTotal) || 0;
    const unreviewed = Number(raw?.unreviewed) || 0;
    return {
      activeTotal,
      unreviewed,
      unreviewedPercent: activeTotal ? Math.round((unreviewed / activeTotal) * 100) : 0,
    };
  }

  private async getGradeDistribution(subjectId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('q.latestGrade', 'grade')
      .addSelect('COUNT(q.id)', 'count')
      .from(Question, 'q')
      .where('q.latestGrade IS NOT NULL')
      .groupBy('q.latestGrade');
    if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });

    const rows = await qb.getRawMany();
    const buckets = Array.from({ length: 10 }, (_, i) => ({ grade: i + 1, count: 0 }));
    for (const r of rows) {
      const g = Number(r.grade);
      if (g >= 1 && g <= 10) buckets[g - 1].count = Number(r.count);
    }
    return buckets;
  }

  // "Latest review per question" subquery — same technique SubjectStatsService uses
  // for "latest attempt per question" (MAX(id) grouped by the FK, then re-joined). No
  // status filter needed any more — every quality_review row is already a final decision.
  private async getFlaggedForRevision(subjectId?: number, limit = 20) {
    const latestReviewSub = this.dataSource
      .createQueryBuilder()
      .subQuery()
      .select('r2.resourceId', 'resourceId')
      .addSelect('MAX(r2.id)', 'maxId')
      .from(QualityReview, 'r2')
      .where('r2.resourceType = :resourceType', { resourceType: QualityResourceTypeEnum.Question })
      .groupBy('r2.resourceId')
      .getQuery();

    const qb = this.dataSource
      .createQueryBuilder()
      .select('q.id', 'questionId')
      .addSelect('q.question', 'questionText')
      .addSelect('q.subjectId', 'subjectId')
      .addSelect('r.outcome', 'outcome')
      .addSelect('r.grade', 'grade')
      .addSelect('r.createdAt', 'submittedAt')
      .from(Question, 'q')
      .innerJoin(`(${latestReviewSub})`, 'la', 'la.resourceId = q.id')
      .innerJoin(QualityReview, 'r', 'r.id = la.maxId')
      .where('r.outcome IN (:...outcomes)', {
        outcomes: [QualityReviewOutcomeEnum.NeedsRevision, QualityReviewOutcomeEnum.Rejected],
      })
      .setParameter('resourceType', QualityResourceTypeEnum.Question)
      .orderBy('r.createdAt', 'DESC')
      .limit(limit);
    if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });

    return qb.getRawMany();
  }

  // Negative-polarity only — this widget is "Top ISSUE Tags". Without this filter, a
  // Positive tag attached on the Approve path (e.g. "Good to Know") would count here
  // too, with a null severity, and render as if it were a low-severity problem.
  private async getTopIssueTags(subjectId?: number, limit = 10) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('m.id', 'metricId')
      .addSelect('m.code', 'code')
      .addSelect('m.label', 'label')
      .addSelect('m.severity', 'severity')
      .addSelect('COUNT(t.id)', 'count')
      .from(QualityReviewTag, 't')
      .innerJoin(QualityMetric, 'm', 'm.id = t.qualityMetricId')
      .innerJoin(QualityReview, 'r', 'r.id = t.qualityReviewId')
      .where('r.resourceType = :resourceType', { resourceType: QualityResourceTypeEnum.Question })
      .andWhere('m.polarity = :polarity', { polarity: QualityMetricPolarityEnum.Negative });
    if (subjectId) {
      qb.innerJoin(Question, 'q', 'q.id = r.resourceId').andWhere('q.subjectId = :subjectId', {
        subjectId,
      });
    }
    qb.groupBy('m.id')
      .addGroupBy('m.code')
      .addGroupBy('m.label')
      .addGroupBy('m.severity')
      .orderBy('count', 'DESC')
      .limit(limit);

    return qb.getRawMany();
  }

  // -- existing-data widgets (QuestionAttempt) ------------------------------------------

  private async getNeverAttempted(subjectId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('q.id', 'questionId')
      .addSelect('q.question', 'questionText')
      .addSelect('q.subjectId', 'subjectId')
      .from(Question, 'q')
      .leftJoin(QuestionAttempt, 'qa', 'qa.questionId = q.id')
      .where('q.status = :active', { active: QuestionStatusEnum.Active })
      .groupBy('q.id')
      .having('COUNT(qa.id) = 0');
    if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });

    return qb.getRawMany();
  }

  private async getAttemptOutliers(subjectId?: number, minSample = MIN_ATTEMPT_SAMPLE) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('q.id', 'questionId')
      .addSelect('q.question', 'questionText')
      .addSelect('q.subjectId', 'subjectId')
      .addSelect('COUNT(qa.id)', 'attempts')
      .addSelect('SUM(CASE WHEN qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correct')
      .addSelect('SUM(CASE WHEN qa.isSkipped = 1 THEN 1 ELSE 0 END)', 'skipped')
      .addSelect('SUM(CASE WHEN qa.hintUsed = 1 THEN 1 ELSE 0 END)', 'hinted')
      .from(Question, 'q')
      .innerJoin(QuestionAttempt, 'qa', 'qa.questionId = q.id')
      .where('q.status = :active', { active: QuestionStatusEnum.Active })
      .groupBy('q.id')
      .having('COUNT(qa.id) >= :minSample')
      .setParameter('minSample', minSample);
    if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });

    const rows = await qb.getRawMany();
    const withRates = rows.map((r) => {
      const attempts = Number(r.attempts);
      return {
        questionId: Number(r.questionId),
        questionText: r.questionText,
        subjectId: Number(r.subjectId),
        attempts,
        correctRate: attempts ? Number(r.correct) / attempts : 0,
        skipRate: attempts ? Number(r.skipped) / attempts : 0,
        hintRate: attempts ? Number(r.hinted) / attempts : 0,
      };
    });

    return {
      tooHard: withRates
        .filter((r) => r.correctRate < TOO_HARD_THRESHOLD)
        .sort((a, b) => a.correctRate - b.correctRate)
        .slice(0, 20),
      tooEasy: withRates
        .filter((r) => r.correctRate > TOO_EASY_THRESHOLD)
        .sort((a, b) => b.correctRate - a.correctRate)
        .slice(0, 20),
      confusing: withRates
        .filter((r) => r.skipRate > CONFUSING_THRESHOLD || r.hintRate > CONFUSING_THRESHOLD)
        .sort((a, b) => b.skipRate + b.hintRate - (a.skipRate + a.hintRate))
        .slice(0, 20),
    };
  }
}
