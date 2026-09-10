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

  // (resourceType, resourceId, reviewerId) is a unique triple — the SAME reviewer reviewing
  // the SAME resource again updates that one row in place instead of inserting a second one.
  // `comment` is the audit trail: every submit appends a dated, human-readable summary of what
  // changed (or a snapshot, on the very first submission) — see buildChangelogEntry — and
  // never erases what was there before. `grade`/`outcome`/tags always reflect only the latest
  // submission. Computes the advisory grade-cap/mismatch transiently (never persisted) and,
  // for Question reviews, rolls the result up onto Question (lastReviewedAt/latestGrade/
  // lastReviewOutcome unconditionally, reviewCount only on a genuine first-time pass by this
  // reviewer) plus the Approve/Reject moderation-status nudge, in one transaction.
  async submitReview(
    resourceType: QualityResourceTypeEnum,
    resourceId: number,
    reviewerId: number,
    input: SubmitQualityReviewInput,
  ): Promise<{
    review: QualityReview;
    suggestedGradeCap: number | null;
    mismatch: boolean;
    reviewCount: number | undefined;
  }> {
    return this.dataSource.transaction(async (manager) => {
      const reviewRepo = manager.getRepository(QualityReview);
      const tagRepo = manager.getRepository(QualityReviewTag);
      const metricRepo = manager.getRepository(QualityMetric);

      const existing = await reviewRepo.findOne({
        where: { resourceType, resourceId, reviewerId },
        relations: { tags: { qualityMetric: true } },
      });

      const tagIds = input.tagIds ?? [];
      const newMetrics = tagIds.length ? await metricRepo.findBy({ id: In(tagIds) }) : [];

      // Built from `existing` before it's mutated below — needs the old grade/outcome/tags
      // to diff against.
      const logEntry = this.buildChangelogEntry(existing, {
        outcome: input.outcome,
        grade: input.grade ?? null,
        tagLabels: newMetrics.map((m) => m.label),
        note: input.comment?.trim() || null,
      });

      let review: QualityReview;
      const isNewReview = !existing;

      if (existing) {
        existing.grade = input.grade ?? null;
        existing.outcome = input.outcome;
        // Append-only — a null comment only happens on data from before this changelog
        // model existed; every row created under this logic always has a non-null comment.
        existing.comment = existing.comment ? `${existing.comment}\n\n${logEntry}` : logEntry;
        review = await reviewRepo.save(existing);
        // Tags always reflect only the latest submission — delete before insert so a
        // tag re-selected unchanged doesn't collide with the (qualityReviewId,
        // qualityMetricId) unique index.
        await tagRepo.delete({ qualityReviewId: review.id });
      } else {
        review = await reviewRepo.save(
          reviewRepo.create({
            resourceType,
            resourceId,
            reviewerId,
            grade: input.grade ?? null,
            outcome: input.outcome,
            comment: logEntry,
          }),
        );
      }

      if (newMetrics.length) {
        await tagRepo.save(
          newMetrics.map((m) => tagRepo.create({ qualityReviewId: review.id, qualityMetricId: m.id })),
        );
      }
      const worst = newMetrics.reduce<QualityMetricSeverityEnum | null>((acc, m) => {
        if (!m.severity) return acc;
        if (!acc || SEVERITY_RANK[m.severity] > SEVERITY_RANK[acc]) return m.severity;
        return acc;
      }, null);
      const suggestedGradeCap = worst ? GRADE_CAP_BY_SEVERITY[worst] : null;
      const mismatch = review.grade != null && suggestedGradeCap != null && review.grade > suggestedGradeCap;

      // Rollup + moderation-status nudge only apply to Question today — Lesson has no
      // equivalent rollup columns yet (same resourceType gate listQualityMetrics uses).
      let reviewCount: number | undefined;
      if (resourceType === QualityResourceTypeEnum.Question) {
        const updateSet: Record<string, unknown> = {
          // This submission's time, not the row's original createdAt — matters once the
          // same row can be updated on a later date.
          lastReviewedAt: review.updatedAt,
          latestGrade: review.grade,
          lastReviewOutcome: review.outcome,
        };
        // Only a genuine first-time pass by this reviewer grows the count — it tracks how
        // many distinct reviewers have weighed in, not how many times this question has
        // been reviewed in total (an SME editing their own review isn't a new pass).
        if (isNewReview) {
          updateSet.reviewCount = () => '`reviewCount` + 1';
        }

        // SME approval nudges moderation status — an Approve promotes a question waiting
        // for its first review into rotation. NeedsRevision/Rejected both pull a live one
        // back out (flagged content shouldn't keep serving while it's under revision — same
        // reasoning getFlaggedForRevision already assumes when it treats both outcomes as
        // "genuinely flagged, therefore Pending"). Anything already Inactive (or
        // Active-and-approved, Pending-and-flagged) is left alone — this only ever moves
        // status one way per outcome, never the reverse or through Inactive. A CASE on the
        // row's *current* status keeps this one atomic update instead of a separate
        // read-then-write with a race window.
        if (review.outcome === QualityReviewOutcomeEnum.Approved) {
          updateSet.status = () =>
            `CASE WHEN \`status\` = '${QuestionStatusEnum.Pending}' THEN '${QuestionStatusEnum.Active}' ELSE \`status\` END`;
        } else if (
          review.outcome === QualityReviewOutcomeEnum.Rejected ||
          review.outcome === QualityReviewOutcomeEnum.NeedsRevision
        ) {
          updateSet.status = () =>
            `CASE WHEN \`status\` = '${QuestionStatusEnum.Active}' THEN '${QuestionStatusEnum.Pending}' ELSE \`status\` END`;
        }

        await manager
          .createQueryBuilder()
          .update(Question)
          .set(updateSet)
          .where('id = :resourceId', { resourceId })
          .execute();

        // createQueryBuilder().update() doesn't return the mutated row (unlike .save()),
        // so the post-increment count needs one cheap single-row PK lookup — this lets the
        // queue patch its cached row in place instead of refetching the whole list, without
        // the client having to (possibly incorrectly, under concurrent SME reviews) infer
        // the new count by incrementing its own last-known value.
        const updatedQuestion = await manager
          .getRepository(Question)
          .findOne({ where: { id: resourceId }, select: ['reviewCount'] });
        reviewCount = updatedQuestion?.reviewCount;
      }

      return { review, suggestedGradeCap, mismatch, reviewCount };
    });
  }

  // Every submit appends one dated entry to `comment` — never edits or removes what's there.
  // First submission (no `existing` row yet) gets a snapshot; a later submission by the same
  // reviewer for the same resource gets a diff against the row's previous grade/outcome/tags,
  // omitting any clause that didn't change. If nothing changed at all, still logs a
  // "resubmitted, no change" entry — the SME re-confirming later is real audit signal, and
  // silently doing nothing would leave a bumped updatedAt unexplained.
  private buildChangelogEntry(
    existing: QualityReview | null,
    next: { outcome: QualityReviewOutcomeEnum; grade: number | null; tagLabels: string[]; note: string | null },
  ): string {
    const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    const newTags = [...new Set(next.tagLabels)].sort();

    if (!existing) {
      const tagsPart = newTags.length ? newTags.join(', ') : 'none';
      const gradePart = next.grade != null ? `${next.grade}/10` : '(none)';
      const header = `[${dateStr}] Review submitted — ${next.outcome}, grade ${gradePart}, tags: ${tagsPart}.`;
      return next.note ? `${header}\nSME note: ${next.note}` : header;
    }

    const oldTags = [
      ...new Set((existing.tags ?? []).map((t) => t.qualityMetric?.label).filter((l): l is string => !!l)),
    ].sort();
    const added = newTags.filter((t) => !oldTags.includes(t));
    const removed = oldTags.filter((t) => !newTags.includes(t));

    const clauses: string[] = [];
    if (existing.outcome !== next.outcome) {
      clauses.push(`Outcome: ${existing.outcome} → ${next.outcome}`);
    }
    if (existing.grade !== next.grade) {
      const oldGradePart = existing.grade != null ? String(existing.grade) : '(none)';
      const newGradePart = next.grade != null ? String(next.grade) : '(none)';
      clauses.push(`Grade: ${oldGradePart} → ${newGradePart}`);
    }
    if (added.length || removed.length) {
      clauses.push(`Tags: ${[...removed.map((t) => `−${t}`), ...added.map((t) => `+${t}`)].join(', ')}`);
    }

    const header = clauses.length
      ? `[${dateStr}] Review updated — ${clauses.join('; ')}.`
      : `[${dateStr}] Review resubmitted — no change to outcome/grade/tags.`;
    return next.note ? `${header}\nSME note: ${next.note}` : header;
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

  // Reviewable universe is Pending OR Active — same fix as the review queue's 'all'/'unreviewed'
  // scope (see getReviewQueue). This used to be Active-only, which meant a subject's coverage%
  // only ever counted its handful of already-promoted questions and silently ignored the bulk
  // of never-reviewed Pending content — making a subject with 1,141 unreviewed Pending
  // questions and 8 reviewed Active ones read as "100% reviewed".
  async getReviewCoverageBySubject(): Promise<
    Map<number, { reviewableTotal: number; unreviewed: number; unreviewedPercent: number }>
  > {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('q.subjectId', 'subjectId')
      .addSelect('COUNT(q.id)', 'reviewableTotal')
      .addSelect('SUM(CASE WHEN q.reviewCount = 0 THEN 1 ELSE 0 END)', 'unreviewed')
      .from(Question, 'q')
      .where('(q.status = :pending OR q.status = :active)', {
        pending: QuestionStatusEnum.Pending,
        active: QuestionStatusEnum.Active,
      })
      .groupBy('q.subjectId')
      .getRawMany();

    return new Map(
      rows.map((r) => {
        const reviewableTotal = Number(r.reviewableTotal) || 0;
        const unreviewed = Number(r.unreviewed) || 0;
        return [
          Number(r.subjectId),
          { reviewableTotal, unreviewed, unreviewedPercent: reviewableTotal ? Math.round((unreviewed / reviewableTotal) * 100) : 0 },
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
    // This page's job is to hand an SME a working batch, not dump the whole question
    // bank — 20 keeps each fetch small and fast regardless of which tab is active. Capped
    // at 100 regardless of what a caller asks for, so a stray ?limit= can't force an
    // unbounded scan/response.
    const limit = Math.min(filters.limit ?? 20, 100);

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
      .leftJoin(Subject, 's', 's.id = q.subjectId');
    if (status === 'unreviewed') {
      // "To Review" is specifically the never-reviewed intake queue: content still sitting
      // in Pending (whether freshly authored or pulled back by a Reject) that no SME has
      // passed judgment on yet. reviewCount=0 alone isn't enough to scope this — Active
      // content can also be reviewCount=0 (e.g. seeded straight to Active), but that's
      // already-serving content, not intake, so it belongs under 'all' rather than here.
      qb.where('q.status = :pending', { pending: QuestionStatusEnum.Pending });
    } else if (status === 'flagged') {
      // A Reject always nudges the question's status to Pending (see submitReview's CASE
      // update), so a genuinely flagged question is Pending by construction — this scope
      // is intentionally narrower than 'all' below.
      qb.where('q.status = :pending', { pending: QuestionStatusEnum.Pending });
    } else {
      qb.where(
        '(q.status = :pending OR q.status = :active)',
        {
          pending: QuestionStatusEnum.Pending,
          active: QuestionStatusEnum.Active,
        },
      );
    }

    if (resolvedSubjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId: resolvedSubjectId });
    if (filters.questionType) qb.andWhere('q.questionType = :questionType', { questionType: filters.questionType });
    if (status === 'unreviewed') qb.andWhere('q.reviewCount = 0');
    if (status === 'flagged') {
      qb.andWhere('q.lastReviewOutcome IN (:...outcomes)', {
        outcomes: [QualityReviewOutcomeEnum.NeedsRevision, QualityReviewOutcomeEnum.Rejected],
      });
    }

    if (status === 'flagged') {
      // Most-recently-flagged first, matching getFlaggedForRevision's own ordering — a
      // reviewCount/createdAt sort is meaningless here (every flagged row already has
      // reviewCount >= 1) and was surfacing the oldest-created flagged questions instead
      // of the ones that most recently need attention.
      qb.orderBy('q.lastReviewedAt', 'DESC');
    } else {
      qb.orderBy('q.reviewCount', 'ASC').addOrderBy('q.createdAt', 'ASC');
    }
    qb.limit(limit);

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

  // Powers the queue header's stat rail — outcome breakdown for whichever subject/questionType
  // combo the SME currently has selected, plus how many of those this specific reviewer has
  // personally passed judgment on. Same reviewable universe as the queue's 'all' tab (Pending
  // OR Active). reviewedByMe counts distinct questions, not review rows — a reviewer editing
  // their own earlier pass doesn't inflate it (see submitReview's isNewReview gate, which is
  // the same distinction reviewCount itself already respects).
  async getSubjectReviewStats(filters: {
    subjectSlug?: string;
    questionType?: QuestionTypeEnum;
    reviewerId: number;
  }): Promise<{
    total: number;
    reviewed: number;
    unreviewed: number;
    approved: number;
    needsRevision: number;
    rejected: number;
    reviewedByMe: number;
  }> {
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
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN q.reviewCount > 0 THEN 1 ELSE 0 END)', 'reviewed')
      .addSelect('SUM(CASE WHEN q.lastReviewOutcome = :approved THEN 1 ELSE 0 END)', 'approved')
      .addSelect('SUM(CASE WHEN q.lastReviewOutcome = :needsRevision THEN 1 ELSE 0 END)', 'needsRevision')
      .addSelect('SUM(CASE WHEN q.lastReviewOutcome = :rejected THEN 1 ELSE 0 END)', 'rejected')
      .from(Question, 'q')
      .where('(q.status = :pending OR q.status = :active)', {
        pending: QuestionStatusEnum.Pending,
        active: QuestionStatusEnum.Active,
      })
      .setParameters({
        approved: QualityReviewOutcomeEnum.Approved,
        needsRevision: QualityReviewOutcomeEnum.NeedsRevision,
        rejected: QualityReviewOutcomeEnum.Rejected,
      });
    if (resolvedSubjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId: resolvedSubjectId });
    if (filters.questionType) qb.andWhere('q.questionType = :questionType', { questionType: filters.questionType });

    const meQb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(DISTINCT r.resourceId)', 'count')
      .from(QualityReview, 'r')
      .innerJoin(Question, 'q', 'q.id = r.resourceId')
      .where('r.resourceType = :resourceType', { resourceType: QualityResourceTypeEnum.Question })
      .andWhere('r.reviewerId = :reviewerId', { reviewerId: filters.reviewerId })
      .andWhere('(q.status = :pending OR q.status = :active)', {
        pending: QuestionStatusEnum.Pending,
        active: QuestionStatusEnum.Active,
      });
    if (resolvedSubjectId) meQb.andWhere('q.subjectId = :subjectId', { subjectId: resolvedSubjectId });
    if (filters.questionType) meQb.andWhere('q.questionType = :questionType', { questionType: filters.questionType });

    const [r, meRow] = await Promise.all([qb.getRawOne(), meQb.getRawOne()]);
    const total = Number(r?.total) || 0;
    const reviewed = Number(r?.reviewed) || 0;
    return {
      total,
      reviewed,
      unreviewed: total - reviewed,
      approved: Number(r?.approved) || 0,
      needsRevision: Number(r?.needsRevision) || 0,
      rejected: Number(r?.rejected) || 0,
      reviewedByMe: Number(meRow?.count) || 0,
    };
  }

  // Embeds reviewHistory (this question's full past review audit trail, newest first) so
  // the SME review dialog only needs one request instead of two — review-detail and history
  // are always requested together, for the same question, every single time.
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
    reviewHistory: QualityReview[];
  } | null> {
    const question = await this.dataSource.getRepository(Question).findOne({
      where: { id: questionId },
      relations: { options: true, subject: true, questionTopics: { topic: true } },
    });
    if (!question) return null;

    const reviewHistory = await this.getReviewHistory(QualityResourceTypeEnum.Question, questionId);

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
      reviewHistory,
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

  // Same Pending-or-Active reviewable-universe fix as getReviewCoverageBySubject — see its
  // comment for why Active-only silently ignored the bulk of never-reviewed content.
  private async getReviewCoverage(subjectId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(q.id)', 'reviewableTotal')
      .addSelect('SUM(CASE WHEN q.reviewCount = 0 THEN 1 ELSE 0 END)', 'unreviewed')
      .from(Question, 'q')
      .where('(q.status = :pending OR q.status = :active)', {
        pending: QuestionStatusEnum.Pending,
        active: QuestionStatusEnum.Active,
      });
    if (subjectId) qb.andWhere('q.subjectId = :subjectId', { subjectId });

    const raw = await qb.getRawOne();
    const reviewableTotal = Number(raw?.reviewableTotal) || 0;
    const unreviewed = Number(raw?.unreviewed) || 0;
    return {
      reviewableTotal,
      unreviewed,
      unreviewedPercent: reviewableTotal ? Math.round((unreviewed / reviewableTotal) * 100) : 0,
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
    // "Latest review per question" — MAX(updatedAt), not MAX(id): a review row can now be
    // updated in place (same reviewer editing their own pass), so an older-id row can become
    // the most recently touched one while a newer-id row from a different reviewer sits
    // unchanged. MAX(id) would silently pick the wrong row once that happens.
    const latestReviewSub = this.dataSource
      .createQueryBuilder()
      .subQuery()
      .select('r2.resourceId', 'resourceId')
      .addSelect('MAX(r2.updatedAt)', 'maxUpdatedAt')
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
      .addSelect('r.updatedAt', 'submittedAt')
      .from(Question, 'q')
      .innerJoin(`(${latestReviewSub})`, 'la', 'la.resourceId = q.id')
      .innerJoin(QualityReview, 'r', 'r.resourceId = la.resourceId AND r.updatedAt = la.maxUpdatedAt')
      .where('r.outcome IN (:...outcomes)', {
        outcomes: [QualityReviewOutcomeEnum.NeedsRevision, QualityReviewOutcomeEnum.Rejected],
      })
      .setParameter('resourceType', QualityResourceTypeEnum.Question)
      .orderBy('r.updatedAt', 'DESC')
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
