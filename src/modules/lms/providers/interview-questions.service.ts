import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { UserQuestionTracker } from 'src/common/typeorm/entities/user-question-tracker.entity';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';

export interface GetInterviewQuestionsFilters {
  subjectSlug: string;
  topicSlug?: string;
  levels?: string; // CSV, e.g. "1,3"
  userId?: number;
}

@Injectable()
export class InterviewQuestionsService {
  constructor(private readonly dataSource: DataSource) {}

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

    const qb = this.dataSource
      .getRepository(Question)
      .createQueryBuilder('q')
      .innerJoin(QuestionTopic, 'qt', 'qt.questionId = q.id')
      .innerJoin(Topic, 't', 't.id = qt.topicId')
      .where('q.subjectId = :subjectId', { subjectId: subject.id })
      .andWhere('q.questionType = :type', { type: QuestionTypeEnum.General })
      .andWhere('q.status = :status', { status: QuestionStatusEnum.Active })
      .select('q.id', 'id')
      .addSelect('q.slug', 'slug')
      .addSelect('q.level', 'level')
      .addSelect('q.question', 'question')
      .addSelect('q.answer', 'answerHtml')
      .addSelect('t.slug', 'topicSlug')
      .addSelect('t.title', 'topicTitle')
      .addSelect('t.shortDesc', 'topicDescription')
      .addSelect('t.order', 'topicOrder')
      .orderBy('t.order', 'ASC')
      .addOrderBy('q.level', 'ASC')
      .addOrderBy('q.orderId', 'ASC');

    if (filters.topicSlug) {
      qb.andWhere('t.slug = :topicSlug', { topicSlug: filters.topicSlug });
    }
    if (levelFilter?.length) {
      qb.andWhere('q.level IN (:...levels)', { levels: levelFilter });
    }

    // Note: a question mapped to more than one topic (question_topic is many-to-many) will
    // legitimately appear once per topic association — correct relational behavior, and
    // today's General content is single-topic-per-question in practice.
    const rows = await qb.getRawMany();

    const questions = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      topicSlug: r.topicSlug,
      topicTitle: r.topicTitle,
      level: r.level,
      question: r.question,
      answerHtml: r.answerHtml,
    }));

    // Topic stats are derived from these real rows, not a separately maintained list — a
    // topic can never be shown with more (or less) content than actually exists behind it.
    // (This mirrors the same fix just made on the frontend's mock data for the same reason.)
    const topicMap = new Map<
      string,
      { slug: string; title: string; description: string; order: number; total: number; easy: number; intermediate: number; advanced: number }
    >();
    for (const r of rows) {
      if (!topicMap.has(r.topicSlug)) {
        topicMap.set(r.topicSlug, {
          slug: r.topicSlug,
          title: r.topicTitle,
          description: r.topicDescription ?? '',
          order: r.topicOrder ?? 0,
          total: 0,
          easy: 0,
          intermediate: 0,
          advanced: 0,
        });
      }
      const t = topicMap.get(r.topicSlug)!;
      t.total += 1;
      if (r.level === 1) t.easy += 1;
      else if (r.level === 2) t.intermediate += 1;
      else if (r.level === 3) t.advanced += 1;
    }
    const topics = [...topicMap.values()]
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...t }) => t);

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
