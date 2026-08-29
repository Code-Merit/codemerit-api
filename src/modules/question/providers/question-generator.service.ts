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
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
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
    const [topicCaps, cooldownQuestionIds] = await Promise.all([
      this.resolveTopicCaps(groupIds, userId),
      this.getCooldownQuestionIds(userId),
    ]);
    const bucketsByCap = this.bucketTopicsByCap(groupIds, topicCaps);

    // Single running list of ids already placed in this quiz, threaded through every
    // selection call below — pass 1's per-bucket loop and pass 2's backfill passes
    // alike — so a question whose two topics land in two *different* buckets can never
    // be picked twice. (A question tagged to two topics within the SAME call is instead
    // collapsed inside the query itself — see getUniqueQuestions()/getRandomQuestions().)
    const existingIds: number[] = [];
    let uniqueQuestions: any[] = [];
    for (const [cap, bucketTopicIds] of bucketsByCap) {
      const bucketQuestions = await this.getUniqueQuestions(
        userId, bucketTopicIds, cap, perGroupCount, cooldownQuestionIds, existingIds,
      );
      uniqueQuestions = uniqueQuestions.concat(bucketQuestions);
      existingIds.push(...bucketQuestions.map(q => q.questionId));
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
      msg = 'random';

      // Pass 1: cooldown-safe backfill — skip anything the user got wrong/skipped in
      // their immediately preceding quiz, so it doesn't resurface the very next time.
      const pass1 = await this.runBackfillPass(
        userId, bucketsByCap, existingIds, missingCount, cooldownQuestionIds,
      );
      uniqueQuestions = uniqueQuestions.concat(pass1.questions);
      missingCount = pass1.missingCount;

      // Pass 2: unconditional fallback, no cooldown exclusion. Only reached when the
      // cooldown-flagged questions were the ONLY remaining candidates in some bucket —
      // the cooldown rule must never itself cause a shortfall or the zero-total error
      // below; a repeat is better than a quiz that can't be generated.
      if (missingCount > 0) {
        const pass2 = await this.runBackfillPass(
          userId, bucketsByCap, existingIds, missingCount, [],
        );
        uniqueQuestions = uniqueQuestions.concat(pass2.questions);
        missingCount = pass2.missingCount;
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

  /**
   * QuestionIds the user got wrong or skipped in their single most-recently-completed
   * quiz. Used as a one-shot cooldown exclusion so a question doesn't immediately
   * resurface in the very next quiz — only the immediately preceding quiz is cooled
   * down, not a window, so this can't compound with small topic pools and exclude an
   * entire pool for several quizzes in a row.
   *
   * Scoped by resultId (the specific submission), not quizId/userQuizId (the quiz
   * itself) — the latter would pull wrong/skipped questions from every past attempt
   * on that quiz if the user had retaken it, not just the last one. Also checks both
   * quizId and userQuizId on lastResult — a UserQuiz result has quizId=null (post
   * Standard/UserQuiz split), so checking quizId alone silently no-ops this for the
   * common case (retaking a UserQuiz-generated practice quiz).
   */
  private async getCooldownQuestionIds(userId: number): Promise<number[]> {
    const lastResult = await this.dataSource.getRepository(QuizResult).findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
      // createdAt must stay in `select` even though only quizId/userQuizId are read
      // below — TypeORM wraps this in a DISTINCT subquery to support the `order`, and
      // drops any column that isn't selected from that subquery, which breaks the
      // ORDER BY at runtime if createdAt isn't included (confirmed against the real
      // dev DB: ER_BAD_FIELD_ERROR).
      select: ['id', 'quizId', 'userQuizId', 'createdAt'],
    });
    if (!lastResult?.quizId && !lastResult?.userQuizId) return [];

    const rows = await this.dataSource.getRepository(QuestionAttempt).find({
      where: [
        { resultId: lastResult.id, isCorrect: false },
        { resultId: lastResult.id, isSkipped: true },
      ],
      select: ['questionId'],
    });
    return [...new Set(rows.map((r) => r.questionId))];
  }

  /** Shared body of the wrong-question backfill loop, run once per pass in generateUserQuiz(). */
  private async runBackfillPass(
    userId: number,
    bucketsByCap: Map<DifficultyLevelEnum, number[]>,
    existingIds: number[],
    missingCount: number,
    cooldownIds: number[],
  ): Promise<{ questions: any[]; missingCount: number }> {
    let questions: any[] = [];
    // Same per-bucket cap here — a thin Easy pool can never spill into a locked tier
    // just to hit the requested count. It's fine to come up short overall; only a
    // zero-total-across-every-bucket result is treated as an error, in generateUserQuiz().
    for (const [cap, bucketTopicIds] of bucketsByCap) {
      if (missingCount <= 0) break;
      const listOfExistingIds = existingIds.length ? existingIds : [0];
      const randomQuestions = await this.getRandomQuestions(
        userId, bucketTopicIds, cap, listOfExistingIds, missingCount, cooldownIds,
      );
      questions = questions.concat(randomQuestions);
      existingIds.push(...randomQuestions.map(q => q.questionId));
      missingCount -= randomQuestions.length;
    }
    return { questions, missingCount };
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
    cooldownIds: number[] = [],
    excludeIds: number[] = [],
  ): Promise<any[]> {
    const groupIdList = groupIds.map(() => '?').join(',');
    // Sentinel 0 keeps the array non-empty (mirrors listOfExistingIds in
    // getRandomQuestions below) — no question ever has id 0, so it's a safe no-op.
    const cooldownList = cooldownIds.length ? cooldownIds : [0];
    const excludeList = excludeIds.length ? excludeIds : [0];

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
          AND q.id NOT IN (?)
          AND q.id NOT IN (?)
      ),
      -- A question tagged to more than one topic in this bucket produces one
      -- grouped_questions row per topic it belongs to (each with its own per-topic rn).
      -- Collapse those down to at most one row per question — keeping whichever topic
      -- ranked it best (lowest rn) — so the same question can never occupy two slots in
      -- the same quiz just because it's cross-tagged.
      deduped_questions AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY questionId ORDER BY rn) as globalRn
        FROM grouped_questions
        WHERE rn <= ?
      )
      SELECT *
      FROM deduped_questions
      WHERE globalRn = 1
      `;
    const params = [
      userId,
      userId,
      ...groupIds,
      levelCap,
      cooldownList,
      excludeList,
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
    cooldownIds: number[] = [],
  ): Promise<any[]> {
    const groupIdList = groupIds.map(() => '?').join(',');
    const cooldownList = cooldownIds.length ? cooldownIds : [0];

    const checkExistQuestionIds = `
      SELECT questionId
      FROM question_attempt
      WHERE userId = ? AND isCorrect = TRUE`;

    // No topic-related columns are read from this query's result anywhere downstream
    // (the response's topic info is rebuilt separately via a dedicated QuestionTopic
    // lookup in generateUserQuiz()) — so topic scope is checked via EXISTS rather than
    // an INNER JOIN, which would otherwise fan out one row per topic a question belongs
    // to and let a cross-tagged question win two of the LIMIT slots below.
    const query2 = `
      SELECT
        q.id AS questionId, q.title, q.question, q.questionType, q.level, q.marks, q.slug, q.timeAllowed, q.tag, q.status, q.answer,
        q.hint, q.orderId, q.createdAt,

        s.id AS subjectId, s.title AS subjectName

      FROM question q
      LEFT JOIN subject s ON s.id = q.subjectId
      LEFT JOIN (
        SELECT DISTINCT questionId FROM question_attempt WHERE userId = ?
      ) aq ON aq.questionId = q.id

      WHERE q.questionType = ?
        AND q.status = ?
        AND q.id NOT IN (${checkExistQuestionIds})
        AND q.id NOT IN (?)
        AND q.id NOT IN (?)
        AND EXISTS (
          SELECT 1 FROM question_topic qt
          WHERE qt.questionId = q.id AND qt.topicId IN (${groupIdList})
        )
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
      cooldownList,                // wrong/skipped in the user's immediately preceding quiz
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
