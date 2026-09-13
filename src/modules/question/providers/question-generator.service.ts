import {
  HttpStatus,
  Injectable
} from '@nestjs/common';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { DataSource, In } from 'typeorm';
import { GetQuestionsByIdsDto } from '../dtos/get-questions-by-ids.dto';
import { QuestionListResponseDto } from '../dtos/question-list-response.dto';
import { TopicAnalysisService } from 'src/modules/master/providers/topic-analysis.service';
import { DEFAULT_QUIZ_LENGTH, MAX_QUIZ_LENGTH, TIER_CLEAR_COVERAGE_PERCENT } from 'src/common/constants/quiz-generation.constants';

/**
 * Single source of truth for self-serve UserQuiz question selection. Walks the scope's
 * topics in Topic.order sequence, draining each one for unique (never-correctly-answered,
 * per question_attempt) questions until numQuestions is reached or the scope runs dry —
 * no upfront per-topic quota, no wrong-question backfill: a shortfall is reported
 * honestly (see requestedCount/actualCount) rather than padded out. Plus a difficulty
 * gate so a topic's Intermediate/Advanced questions only become eligible once the user
 * has demonstrated coverage of the tier below — see computeMaxEligibleLevel(). Standard
 * (admin-curated, explicit-questionIds) quizzes do not go through this service.
 */
@Injectable()
export class QuestionGeneratorService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly topicAnalysisService: TopicAnalysisService,
  ) { }

  async generateUserQuiz(
    userId: number,
    dto: GetQuestionsByIdsDto
  ): Promise<QuestionListResponseDto[]> {

    const { subjectIds = [], topicIds = [], subjectTrackIds = [] } = dto;
    if (subjectIds.length === 0 && topicIds.length === 0 && subjectTrackIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'At least one of subjects, topics, or subjectTracks must be provided.'
      );
    }

    // A bad numQuestions can reach here two ways even though CreateQuizDto.numQuestions
    // itself has @Min(1): a caller can supply it via settings.numQuestions instead (no
    // such guard there), and this service has its own callers beyond quiz.service.ts.
    // Reject clearly rather than let 0/negative silently fall through to a confusing
    // "found 0, need 0" 404 further down.
    if (
      dto.numQuestions !== undefined &&
      (!Number.isFinite(dto.numQuestions) || dto.numQuestions <= 0)
    ) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'numQuestions must be a positive number.',
      );
    }

    // Belt-and-suspenders: quiz.service.ts already clamps against MAX_QUIZ_LENGTH before
    // building this DTO, but this is the one place that actually enforces "never more
    // than MAX_QUIZ_LENGTH" regardless of what any future caller passes in. Floored so a
    // fractional value (e.g. 5.5) can't reach LIMIT/rn<=? as a non-integer downstream.
    const numQuestions = Math.min(
      Math.floor(dto.numQuestions ?? DEFAULT_QUIZ_LENGTH),
      MAX_QUIZ_LENGTH,
    );

    // A quiz can be requested by subject, topic, and/or subjectTrack at once — these
    // combine (union of topics), they don't override each other. Everything is
    // resolved down to one ordered topic-level list so the same sequential-drain loop
    // below applies no matter which scope(s) were asked for.
    const groupIds = await this.resolveTopicIds(subjectIds, topicIds, subjectTrackIds);
    if (groupIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        'No content available for this quiz yet. Please try a different subject or topic.'
      );
    }

    // One batched cap lookup for every topic in scope — a pure read, no per-call query
    // concern (see TopicAnalysisService.getTopicStatsByIds) — consulted per-topic as the
    // loop below visits each one in order.
    const topicCaps = await this.resolveTopicCaps(groupIds, userId);

    // Sequential drain: visit topics in resolveTopicIds()'s Topic.order sequence, pulling
    // as many still-unique/eligible questions as are still needed from each one. No
    // upfront per-topic quota and no wrong-question backfill — a topic that runs out
    // early just means the next topic in sequence supplies the rest. excludeIds
    // accumulates across topics so a question cross-tagged into two topics in scope is
    // never selected twice.
    const excludeIds: number[] = [];
    let uniqueQuestions: any[] = [];
    for (const topicId of groupIds) {
      if (uniqueQuestions.length >= numQuestions) break;
      const remaining = numQuestions - uniqueQuestions.length;
      const cap = topicCaps.get(topicId) ?? DifficultyLevelEnum.Easy;
      const rows = await this.getUniqueQuestionsForTopic(userId, topicId, cap, excludeIds, remaining);
      if (rows.length > 0) {
        uniqueQuestions = uniqueQuestions.concat(rows);
        excludeIds.push(...rows.map(q => q.questionId));
      }
    }

    if (uniqueQuestions.length === 0) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        "You've answered every available question here. Try another topic, or check back later for new ones."
      );
    }

    const questionIds = uniqueQuestions.map(q => q.questionId);

    const [options, questionTopics] = await Promise.all([
      this.dataSource.getRepository(QuestionOption).find({ where: { questionId: In(questionIds) } }),
      this.dataSource.getRepository(QuestionTopic).find({ where: { questionId: In(questionIds) }, relations: ["topic"] }),
    ]);

    const optionsMap = new Map<number, QuestionOption[]>();
    for (const opt of options) {
      if (!optionsMap.has(opt.questionId)) optionsMap.set(opt.questionId, []);
      optionsMap.get(opt.questionId).push(opt);
    }

    const topicsMap = new Map<number, any[]>();
    for (const qt of questionTopics) {
      if (!topicsMap.has(qt.questionId)) topicsMap.set(qt.questionId, []);
      if (qt.topic) {
        topicsMap.get(qt.questionId).push({
          id: qt.topic.id,
          title: qt.topic.title,
          description: qt.topic.description,
          createdAt: qt.topic.createdAt,
        });
      }
    }

    const requestedCount = numQuestions;
    const actualCount = uniqueQuestions.length;
    const message = actualCount < requestedCount
      ? `Quiz created with ${actualCount} of ${requestedCount} requested questions — that's all the new questions currently available for this scope.`
      : `Quiz created successfully with ${actualCount} questions.`;

    const response: any = {
      message,
      questions: this.mappedQuestionList(uniqueQuestions, topicsMap, optionsMap),
      requestedCount,
      actualCount,
    }
    return response;
  }

  private mappedQuestionList(
    questions: any[],
    topicsMap?: Map<number, any[]>,
    optionsMap?: Map<number, any[]>,
  ): any[] {
    return questions.map((q: any) => ({
      id: (q.id) ? q.id : q.questionId,
      title: q.title,
      question: q.question,
      subjectId: q.subjectId,
      questionType: q.questionType,
      level: q.level,
      marks: q.marks,
      slug: q.slug,
      timeAllowed: q.timeAllowed,
      tag: q.tag,
      status: q.status,
      answer: q.answer,
      hint: q.hint,
      order: q.orderId,
      createdAt: q.createdAt,
      subject: q.subject,
      topics: topicsMap.get((q.id) ? q.id : q.questionId) || [],
      options: optionsMap.get((q.id) ? q.id : q.questionId) || [],
    }));
  }

  /**
   * Resolves subjectIds/topicIds/subjectTrackIds down to one deduplicated, ORDERED list
   * of topicIds: subjects and subjectTracks are expanded to their member topics
   * (published only), explicit topicIds pass through as-is. The result is sorted by
   * Topic.order ASC (tie-broken by id) regardless of which scope a topic came from —
   * subject_track_topic has no ordering column of its own, so subjectTrack-scoped quizzes
   * fall back to Topic.order too. This is the one place a scope's topics get their
   * traversal order for the sequential drain in generateUserQuiz().
   */
  private async resolveTopicIds(
    subjectIds: number[],
    topicIds: number[],
    subjectTrackIds: number[],
  ): Promise<number[]> {
    const resolved = new Set<number>(topicIds);

    if (subjectIds.length > 0) {
      const rows = await this.dataSource.getRepository(Topic).find({
        where: { subjectId: In(subjectIds), isPublished: true },
        select: ['id'],
      });
      rows.forEach((r) => resolved.add(r.id));
    }

    if (subjectTrackIds.length > 0) {
      const rows = await this.dataSource
        .createQueryBuilder()
        .select('stt.topicId', 'topicId')
        .from('subject_track_topic', 'stt')
        .innerJoin('subject_track', 'st', 'st.id = stt.subjectTrackId AND st.isPublished = 1')
        .innerJoin('topic', 't', 't.id = stt.topicId AND t.isPublished = 1')
        .where('stt.subjectTrackId IN (:...subjectTrackIds)', { subjectTrackIds })
        .getRawMany();
      rows.forEach((r) => resolved.add(+r.topicId));
    }

    if (resolved.size === 0) return [];

    const ordered = await this.dataSource.getRepository(Topic).find({
      where: { id: In([...resolved]) },
      select: ['id'],
      order: { order: 'ASC', id: 'ASC' },
    });
    return ordered.map((t) => t.id);
  }

  /**
   * Guided "keep going" resolution for quiz.service.ts's `continueThroughSubject` flag:
   * given one seed topicId, returns that topic plus every published topic after it
   * (Topic.order ASC, id tie-break — same ordering resolveTopicIds uses) within the SAME
   * subject only, never crossing into another subject even if the seed topic also belongs
   * to a subjectTrack. This is what lets a guided quiz roll forward instead of hard-stopping
   * once the seed topic itself runs out of unique/eligible questions — see the sequential
   * drain loop in generateUserQuiz() above, which just walks whatever topic list it's given.
   * Falls back to `[topicId]` if the seed can't be found (e.g. deleted between the caller's
   * read and this request) — the seed always resolves to at least itself.
   */
  async resolveForwardTopicSequence(topicId: number): Promise<number[]> {
    const seed = await this.dataSource.getRepository(Topic).findOne({
      where: { id: topicId },
      select: ['id', 'subjectId', 'order'],
    });
    if (!seed) return [topicId];

    const laterRows = await this.dataSource
      .getRepository(Topic)
      .createQueryBuilder('t')
      .select('t.id', 'id')
      .where('t.subjectId = :subjectId', { subjectId: seed.subjectId })
      .andWhere('t.isPublished = 1')
      .andWhere('t.id != :seedId', { seedId: seed.id })
      .andWhere('(t.order > :order OR (t.order = :order AND t.id > :id))', {
        order: seed.order,
        id: seed.id,
      })
      .orderBy('t.order', 'ASC')
      .addOrderBy('t.id', 'ASC')
      .getRawMany<{ id: string }>();

    return [seed.id, ...laterRows.map((r) => +r.id)];
  }

  /**
   * A tier is "cleared" once the user has correctly answered >= TIER_CLEAR_COVERAGE_PERCENT
   * of that topic's OWN question pool at that tier — not the topic's overall coverage.
   * Checking against the whole topic's pool (as the existing dashboard mastery formula
   * does) would mean a user capped to Easy-only could never reach the bar on topics
   * where Easy is a minority of the bank, permanently trapping them on Easy. A tier with
   * zero questions in this topic has nothing to gate, so it's treated as cleared.
   */
  private computeMaxEligibleLevel(stat: {
    correctEasy: number; numBasicTrivia: number;
    correctMedium: number; numIntTrivia: number;
  }): DifficultyLevelEnum {
    const tierCleared = (correct: number, total: number) =>
      total === 0 || (correct / total) * 100 >= TIER_CLEAR_COVERAGE_PERCENT;

    if (!tierCleared(stat.correctEasy, stat.numBasicTrivia)) return DifficultyLevelEnum.Easy;
    if (!tierCleared(stat.correctMedium, stat.numIntTrivia)) return DifficultyLevelEnum.Intermediate;
    return DifficultyLevelEnum.Advanced;
  }

  private async resolveTopicCaps(
    topicIds: number[],
    userId: number,
  ): Promise<Map<number, DifficultyLevelEnum>> {
    const stats = await this.topicAnalysisService.getTopicStatsByIds(topicIds, userId);
    const caps = new Map<number, DifficultyLevelEnum>();
    for (const stat of stats) {
      caps.set(stat.id, this.computeMaxEligibleLevel(stat));
    }
    // Defensive default for a topic missing from stats (shouldn't happen — resolveTopicIds
    // already filters to published, existing topics) — stay capped to Easy rather than risk
    // serving an ungated tier.
    for (const id of topicIds) {
      if (!caps.has(id)) caps.set(id, DifficultyLevelEnum.Easy);
    }
    return caps;
  }

  /**
   * Pulls up to `limit` never-correctly-answered questions for ONE topic, at or under
   * levelCap, in a fixed/deterministic order (no RAND() — a retake with no new attempts
   * returns the same questions in the same order). Called once per topic per iteration
   * of the sequential drain loop in generateUserQuiz(); `excludeIds` is the running list
   * of question ids already placed earlier in this same generation (from any prior topic
   * in the loop), so a question cross-tagged to two topics in scope can never be
   * selected twice.
   */
  private async getUniqueQuestionsForTopic(
    userId: number,
    topicId: number,
    levelCap: DifficultyLevelEnum,
    excludeIds: number[],
    limit: number,
  ): Promise<any[]> {
    if (limit <= 0) return [];
    // Sentinel 0 keeps the array non-empty for the NOT IN clause — no question ever has id 0.
    const excludeList = excludeIds.length ? excludeIds : [0];

    const rawQuery = `
      SELECT
        q.id AS questionId, q.title, q.question, q.questionType, q.level, q.marks, q.slug,
        q.timeAllowed, q.tag, q.status, q.answer, q.hint, q.orderId, q.createdAt,
        s.id AS subjectId, s.title AS subjectName,
        t.id AS topicId, t.title AS topicTitle, t.description AS topicDescription
      FROM question q
      LEFT JOIN subject s ON s.id = q.subjectId
      INNER JOIN question_topic qt ON qt.questionId = q.id AND qt.topicId = ?
      LEFT JOIN topic t ON t.id = qt.topicId
      WHERE q.questionType = ?
        AND q.status = ?
        AND q.level <= ?
        AND q.id NOT IN (?)
        AND NOT EXISTS (
          SELECT 1 FROM question_attempt qa
          WHERE qa.questionId = q.id AND qa.userId = ? AND qa.isCorrect = TRUE
        )
      ORDER BY q.level ASC, q.orderId ASC, q.id ASC
      LIMIT ?
    `;
    const params = [
      topicId,
      QuestionTypeEnum.Trivia,
      QuestionStatusEnum.Active,
      levelCap,
      excludeList,
      userId,
      limit,
    ];
    return this.dataSource.query(rawQuery, params);
  }
}
