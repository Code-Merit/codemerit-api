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
import { shuffleArray } from 'src/common/utils/common-functions';

/**
 * Single source of truth for self-serve UserQuiz question selection. Replaces the old
 * UserQuestionService: same "unique/never-correctly-answered-first, random top-up"
 * mechanics, plus a difficulty gate so a topic's Intermediate/Advanced questions only
 * become eligible once the user has demonstrated coverage of the tier below — see
 * computeMaxEligibleLevel(). Standard (admin-curated, explicit-questionIds) quizzes do
 * not go through this service.
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
    let msg: string = 'unique';
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
    // resolved down to one topic-level pool so a single partitioning/fairness scheme
    // (one ROW_NUMBER group per topic) applies no matter which scope(s) were asked for.
    const groupIds = await this.resolveTopicIds(subjectIds, topicIds, subjectTrackIds);
    if (groupIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        'No published topics found for the given subject(s)/topic(s)/subjectTrack(s).'
      );
    }
    const perGroupCount = Math.ceil(numQuestions / groupIds.length);

    // Each topic gets its own max-eligible-difficulty cap from the user's attempt
    // history, then topics are bucketed by that cap (at most 3 buckets) so one query per
    // bucket can enforce it — avoids a dynamic per-topic cap join in raw SQL.
    const topicCaps = await this.resolveTopicCaps(groupIds, userId);
    const bucketsByCap = this.bucketTopicsByCap(groupIds, topicCaps);

    let uniqueQuestions: any[] = [];
    for (const [cap, bucketTopicIds] of bucketsByCap) {
      const bucketQuestions = await this.getUniqueQuestions(userId, bucketTopicIds, cap, perGroupCount);
      uniqueQuestions = uniqueQuestions.concat(bucketQuestions);
    }

    // perGroupCount is a ceil()'d per-topic quota, so it's always at least 1 — when the
    // scope spans many more topics than numQuestions (e.g. an initial assessment scoped
    // to a job role with 150+ topics across its subjects), "at least 1 per topic" can
    // overshoot the requested total by a large margin. Trim back down here so the cap
    // holds regardless of topic count; shuffled first so no topic is systematically
    // favored by bucket/iteration order.
    if (uniqueQuestions.length > numQuestions) {
      uniqueQuestions = shuffleArray(uniqueQuestions).slice(0, numQuestions);
    }

    if (uniqueQuestions.length < numQuestions) {
      let missingCount = numQuestions - uniqueQuestions.length;
      const existingIds = uniqueQuestions.map(q => q.questionId);
      msg = 'random';

      // Same per-bucket cap here — a thin Easy pool can never spill into a locked tier
      // just to hit the requested count. It's fine to come up short overall; only a
      // zero-total-across-every-bucket result is treated as an error, below.
      for (const [cap, bucketTopicIds] of bucketsByCap) {
        if (missingCount <= 0) break;
        const listOfExistingIds = existingIds.length ? existingIds : [0];
        const randomQuestions = await this.getRandomQuestions(
          userId, bucketTopicIds, cap, listOfExistingIds, missingCount,
        );
        uniqueQuestions = uniqueQuestions.concat(randomQuestions);
        existingIds.push(...randomQuestions.map(q => q.questionId));
        missingCount -= randomQuestions.length;
      }
    }

    if (uniqueQuestions.length === 0) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Not enough ${msg} questions available. Found ${uniqueQuestions.length}, need ${numQuestions}.`
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

    const response: any = {
      message: `Quiz created successfully with ${msg} questions.`,
      questions: this.mappedQuestionList(uniqueQuestions, topicsMap, optionsMap),
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
   * Resolves subjectIds/topicIds/subjectTrackIds down to one deduplicated set of
   * topicIds: subjects and subjectTracks are expanded to their member topics
   * (published only), explicit topicIds pass through as-is.
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

    return [...resolved];
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

  /** Groups topic IDs by their max eligible level — at most 3 buckets, one query each. */
  private bucketTopicsByCap(
    topicIds: number[],
    caps: Map<number, DifficultyLevelEnum>,
  ): Map<DifficultyLevelEnum, number[]> {
    const buckets = new Map<DifficultyLevelEnum, number[]>();
    for (const id of topicIds) {
      const cap = caps.get(id) ?? DifficultyLevelEnum.Easy;
      if (!buckets.has(cap)) buckets.set(cap, []);
      buckets.get(cap).push(id);
    }
    return buckets;
  }

  private async getUniqueQuestions(
    userId: number,
    groupIds: number[],
    levelCap: DifficultyLevelEnum,
    perGroupCount: number,
  ): Promise<any[]> {
    const groupIdList = groupIds.map(() => '?').join(',');

    const rawQuery = `
      WITH correct_questions AS (
        SELECT questionId
        FROM question_attempt
        WHERE userId = ? AND isCorrect = TRUE
      ),
      attempted_questions AS (
        SELECT DISTINCT questionId
        FROM question_attempt
        WHERE userId = ?
      ),
      grouped_questions AS (
        SELECT
        q.id AS questionId, q.title, q.question, q.questionType, q.level, q.marks, q.slug, q.timeAllowed, q.tag, q.status, q.answer, q.hint,
          q.orderId, q.createdAt,

          s.id AS subjectId, s.title AS subjectName,

          t.id AS topicId, t.title AS topicTitle, t.description AS topicDescription,

          qt.topicId AS groupId,
          -- Level-first, then never-attempted-first: within a topic's quota, Easy rows
          -- always sort ahead of Intermediate/Advanced, so the rn <= perGroupCount cutoff
          -- below naturally exhausts Easy before spilling into higher tiers.
          ROW_NUMBER() OVER (
            PARTITION BY qt.topicId
            ORDER BY q.level ASC, CASE WHEN aq.questionId IS NOT NULL THEN 1 ELSE 0 END ASC, RAND()
          ) as rn

        FROM question q

        LEFT JOIN subject s ON s.id = q.subjectId
        INNER JOIN question_topic qt ON qt.questionId = q.id
        LEFT JOIN topic t ON t.id = qt.topicId
        LEFT JOIN attempted_questions aq ON aq.questionId = q.id

        WHERE q.questionType = 'Trivia'
          AND q.status = 'Active'
          AND qt.topicId IN (${groupIdList})
          AND q.level <= ?
          AND NOT EXISTS (
            SELECT 1 FROM correct_questions cq WHERE cq.questionId = q.id
          )
      )
      SELECT *
      FROM grouped_questions
      WHERE rn <= ?
      `;
    const params = [
      userId,
      userId,
      ...groupIds,
      levelCap,
      perGroupCount
    ];
    return this.dataSource.query(rawQuery, params);
  }

  private async getRandomQuestions(
    userId: number,
    groupIds: number[],
    levelCap: DifficultyLevelEnum,
    listOfExistingIds: number[],
    missingCount: number,
  ): Promise<any[]> {
    const groupIdList = groupIds.map(() => '?').join(',');

    const checkExistQuestionIds = `
      SELECT questionId
      FROM question_attempt
      WHERE userId = ? AND isCorrect = TRUE`;

    const query2 = `
      SELECT
        q.id AS questionId, q.title, q.question, q.questionType, q.level, q.marks, q.slug, q.timeAllowed, q.tag, q.status, q.answer,
        q.hint, q.orderId, q.createdAt,

        s.id AS subjectId, s.title AS subjectName,

        t.id AS topicId, t.title AS topicTitle, t.description AS topicDescription

      FROM question q
      LEFT JOIN subject s ON s.id = q.subjectId
      INNER JOIN question_topic qt ON qt.questionId = q.id
      LEFT JOIN topic t ON t.id = qt.topicId
      LEFT JOIN (
        SELECT DISTINCT questionId FROM question_attempt WHERE userId = ?
      ) aq ON aq.questionId = q.id

      WHERE q.questionType = ?
        AND q.status = ?
        AND q.id NOT IN (${checkExistQuestionIds})
        AND q.id NOT IN (?)
        AND qt.topicId IN (${groupIdList})
        AND q.level <= ?

      ORDER BY q.level, (aq.questionId IS NOT NULL) ASC, RAND()
      LIMIT ?;
  `;
    const params2 = [
      userId,                     // attempted_questions subquery, for priority ordering
      QuestionTypeEnum.Trivia,         // questionType
      QuestionStatusEnum.Active,       // status
      userId,                     // already-correctly-answered exclusion
      listOfExistingIds,                 // existingIds from earlier selection
      ...groupIds,
      levelCap,
      missingCount                     // limit
    ];
    return this.dataSource.query(
      query2,
      params2
    );
  }
}
