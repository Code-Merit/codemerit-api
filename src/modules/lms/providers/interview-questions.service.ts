import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, In, SelectQueryBuilder } from 'typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { UserQuestionTracker } from 'src/common/typeorm/entities/user-question-tracker.entity';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { EnrollmentTierEnum, isTierAtLeast } from 'src/common/enum/enrollment-tier.enum';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';

export interface GetInterviewQuestionsFilters {
  subjectSlug: string;
  topicSlug?: string;
  levels?: string; // CSV, e.g. "1,3"
  userId?: number;
}

// Everyone — anonymous included — gets this many full Q&A PER TOPIC regardless of tier,
// preserving the sign-up incentive across every topic, not just the first one. Below
// Intern tier, this is also the hard ceiling on how many rows this endpoint EVER fetches
// per topic from the database — a locked question's content is never queried, built, or
// sent for a caller who can't see it, so a subject with hundreds of questions doesn't
// balloon the response (or the DB scan) just because most of them are locked.
const FREE_PREVIEW_COUNT = 5;

@Injectable()
export class InterviewQuestionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly skillEnrollmentService: SkillEnrollmentService,
  ) {}

  private applyContentFilters(
    qb: SelectQueryBuilder<Question>,
    subjectId: number,
    topicSlug: string | undefined,
    levelFilter: number[] | undefined,
  ): void {
    qb.where('q.subjectId = :subjectId', { subjectId })
      .andWhere('q.questionType = :type', { type: QuestionTypeEnum.General })
      .andWhere('q.status = :status', { status: QuestionStatusEnum.Active });
    if (topicSlug) {
      qb.andWhere('t.slug = :topicSlug', { topicSlug });
    }
    if (levelFilter?.length) {
      qb.andWhere('q.level IN (:...levels)', { levels: levelFilter });
    }
  }

  // Intended call pattern: the client fetches this once per subject per session (cached
  // client-side) and applies topicSlug/level filtering against that cached list rather than
  // refetching — topicSlug/levels are still honored server-side so the endpoint is generically
  // useful to any caller that wants server-side filtering instead.
  async getInterviewQuestions(filters: GetInterviewQuestionsFilters) {
    const subject = await this.dataSource.getRepository(Subject).findOne({
      where: { slug: filters.subjectSlug },
      select: ['id', 'slug', 'title', 'image'],
    });
    if (!subject) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `No subject found for slug "${filters.subjectSlug}".`,
      );
    }

    const levelFilter = filters.levels
      ?.split(',')
      .map((v) => Number(v))
      .filter((v) => [1, 2, 3].includes(v));

    // null (anonymous, or logged in but never enrolled) is treated the same as Basic
    // here — zero access to the gated tier, same as every other tier check in this app
    // (getUserTierForSubject's null means "not enrolled at all"). Resolved BEFORE either
    // query below, since it decides whether the row-fetch even needs the per-topic limit.
    const tier = await this.skillEnrollmentService.getUserTierForSubject(filters.userId, subject.id);
    const isFullyUnlocked = !!tier && isTierAtLeast(tier, EnrollmentTierEnum.Intern);

    // Topic stats (total/easy/intermediate/advanced) are a cheap aggregate query, computed
    // over every matching question regardless of lock state — so a topic's real size is
    // always shown accurately, without ever pulling the locked rows' actual content.
    const statsQb = this.dataSource
      .getRepository(Question)
      .createQueryBuilder('q')
      .innerJoin(QuestionTopic, 'qt', 'qt.questionId = q.id')
      .innerJoin(Topic, 't', 't.id = qt.topicId')
      .select('t.slug', 'topicSlug')
      .addSelect('t.title', 'topicTitle')
      .addSelect('t.shortDesc', 'topicDescription')
      .addSelect('t.order', 'topicOrder')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN q.level = 1 THEN 1 ELSE 0 END)', 'easy')
      .addSelect('SUM(CASE WHEN q.level = 2 THEN 1 ELSE 0 END)', 'intermediate')
      .addSelect('SUM(CASE WHEN q.level = 3 THEN 1 ELSE 0 END)', 'advanced')
      .groupBy('t.id')
      .orderBy('t.order', 'ASC');
    this.applyContentFilters(statsQb, subject.id, filters.topicSlug, levelFilter);
    const topicRows = await statsQb.getRawMany();

    const topics = topicRows.map((r) => {
      const total = Number(r.total);
      // Below Intern, only the first FREE_PREVIEW_COUNT per topic are ever fetched (see the
      // row query below) — lockedCount tells the client how many more exist without the
      // client ever having received a row for them.
      const unlockedCount = isFullyUnlocked ? total : Math.min(FREE_PREVIEW_COUNT, total);
      return {
        slug: r.topicSlug,
        title: r.topicTitle,
        description: r.topicDescription ?? '',
        total,
        easy: Number(r.easy),
        intermediate: Number(r.intermediate),
        advanced: Number(r.advanced),
        lockedCount: total - unlockedCount,
      };
    });

    // Row fetch: unrestricted for Intern+, capped to FREE_PREVIEW_COUNT per topic
    // otherwise via a ROW_NUMBER() window (partitioned per topic, same
    // level-then-orderId order the old in-memory per-topic counter used) — the cap is
    // enforced by the database itself, not by fetching everything and slicing in JS.
    let rows: any[];
    if (isFullyUnlocked) {
      const qb = this.dataSource
        .getRepository(Question)
        .createQueryBuilder('q')
        .innerJoin(QuestionTopic, 'qt', 'qt.questionId = q.id')
        .innerJoin(Topic, 't', 't.id = qt.topicId')
        .select('q.id', 'id')
        .addSelect('q.slug', 'slug')
        .addSelect('q.level', 'level')
        .addSelect('q.tag', 'tag')
        .addSelect('q.question', 'question')
        .addSelect('q.answer', 'answerHtml')
        .addSelect('t.slug', 'topicSlug')
        .addSelect('t.title', 'topicTitle')
        .addSelect('t.order', 'topicOrder')
        .orderBy('t.order', 'ASC')
        .addOrderBy('q.level', 'ASC')
        .addOrderBy('q.orderId', 'ASC');
      this.applyContentFilters(qb, subject.id, filters.topicSlug, levelFilter);
      // Note: a question mapped to more than one topic (question_topic is many-to-many)
      // legitimately appears once per topic association — correct relational behavior.
      rows = await qb.getRawMany();
    } else {
      const outerQb = this.dataSource
        .createQueryBuilder()
        .select('ranked.*')
        .from((subQb) => {
          const inner = subQb
            .select('q.id', 'id')
            .addSelect('q.slug', 'slug')
            .addSelect('q.level', 'level')
            .addSelect('q.tag', 'tag')
            .addSelect('q.question', 'question')
            .addSelect('q.answer', 'answerHtml')
            .addSelect('t.slug', 'topicSlug')
            .addSelect('t.title', 'topicTitle')
            .addSelect('t.order', 'topicOrder')
            .addSelect(
              'ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY q.level ASC, q.orderId ASC)',
              'rn',
            )
            .from(Question, 'q')
            .innerJoin(QuestionTopic, 'qt', 'qt.questionId = q.id')
            .innerJoin(Topic, 't', 't.id = qt.topicId');
          this.applyContentFilters(inner, subject.id, filters.topicSlug, levelFilter);
          return inner;
        }, 'ranked')
        .where('ranked.rn <= :freePreviewCount', { freePreviewCount: FREE_PREVIEW_COUNT })
        .orderBy('ranked.topicOrder', 'ASC')
        .addOrderBy('ranked.level', 'ASC')
        .addOrderBy('ranked.rn', 'ASC');
      rows = await outerQb.getRawMany();
    }

    const questions = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      topicSlug: r.topicSlug,
      topicTitle: r.topicTitle,
      level: r.level,
      tag: r.tag,
      question: r.question,
      answerHtml: r.answerHtml,
    }));

    let completedIds: number[] = [];
    if (filters.userId && questions.length) {
      const completions = await this.dataSource.getRepository(UserQuestionTracker).find({
        where: { userId: filters.userId, questionId: In(questions.map((q) => q.id)) },
        select: ['questionId'],
      });
      completedIds = completions.map((c) => c.questionId);
    }

    return {
      subject: { slug: subject.slug, title: subject.title, image: subject.image },
      topics,
      questions,
      completedIds,
    };
  }

  // One row per (userId, questionId) via the DB unique index — calling this again for an
  // already-completed question is a harmless no-op that returns the original completedAt
  // (alreadyCompleted: true) instead of erroring or duplicating. No unmark/toggle endpoint.
  async markComplete(userId: number, questionId: number) {
    const repo = this.dataSource.getRepository(UserQuestionTracker);
    const existing = await repo.findOne({ where: { userId, questionId } });
    if (existing) {
      return { completed: true, completedAt: existing.completedAt, alreadyCompleted: true };
    }

    const question = await this.dataSource.getRepository(Question).findOne({
      where: { id: questionId },
      select: ['id'],
    });
    if (!question) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `No question found for id ${questionId}.`);
    }

    try {
      const row = await repo.save(repo.create({ userId, questionId }));
      return { completed: true, completedAt: row.completedAt, alreadyCompleted: false };
    } catch (e: any) {
      // Race-safety backstop: the DB unique index is the real guarantee against a duplicate
      // row — if two requests land concurrently, the loser just re-reads what the winner wrote.
      if (e?.code === 'ER_DUP_ENTRY') {
        const row = await repo.findOne({ where: { userId, questionId } });
        return { completed: true, completedAt: row?.completedAt, alreadyCompleted: true };
      }
      throw e;
    }
  }
}
