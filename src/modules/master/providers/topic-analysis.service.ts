import { Injectable } from '@nestjs/common';
import { TOPIC_DONE } from 'src/common/constants/completion-thresholds';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { computeAttemptMetrics, getAggregateUserLevel } from 'src/common/utils/common-functions';
import { GetUserRequestDto } from 'src/core/auth/dto/get-user-request.dto';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { DataSource } from 'typeorm';

@Injectable()
export class TopicAnalysisService {
  constructor(private readonly dataSource: DataSource) {}

  // In your service class

  /**
   * Build a base QB that returns per-topic aggregates.
   * - numTrivia: count of Trivia questions in the topic
   * - totalQuestions: ALL questions in the topic (any type)
   * - totalAttempts: ALL attempts (all users) on any questions in the topic
   * - If userId provided: numMyAttempts, myCorrect, myDistinctQuestions
   */
  private buildTopicStatsBaseQB(
    userId?: number,
    user?: GetUserRequestDto | number,
  ) {
    const qb = this.dataSource
      .createQueryBuilder()
      .from(Topic, 't')
      .leftJoin('subject', 's', 's.id = t.subjectId')
      // All questions in the topic
      .leftJoin('question_topic', 'qt', 'qt.topicId = t.id')
      .leftJoin('question', 'q', 'q.id = qt.questionId')
      // Trivia questions only
      .leftJoin(
        'question',
        'qTr',
        'qTr.id = qt.questionId AND qTr.questionType = :trivia AND qTr.status = :questionStatus',
        {
          trivia: QuestionTypeEnum.Trivia,
          questionStatus: QuestionStatusEnum.Active,
        },
      )

      .select('t.id', 'topicId')
      .addSelect('t.title', 'topicTitle')
      .addSelect('t.description', 'topicDesc')
      .addSelect('t.slug', 'slug')
      .addSelect('t.label', 'label')
      .addSelect('t.subjectId', 'subjectId')
      .addSelect('s.title', 'subjectName')
      .addSelect('t.goal', 'goal')

      // Total question counts
      .addSelect('COUNT(DISTINCT q.id)', 'totalQuestions')
      .addSelect('COUNT(DISTINCT qTr.id)', 'numTrivia')
      .addSelect(
        `COUNT(DISTINCT CASE WHEN qTr.level = :easy THEN qTr.id END)`,
        'numBasicTrivia',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN qTr.level = :medium THEN qTr.id END)`,
        'numIntTrivia',
      )
      .addSelect(
        `COUNT(DISTINCT CASE WHEN qTr.level = :hard THEN qTr.id END)`,
        'numAdvTrivia',
      )
      .setParameter('easy', DifficultyLevelEnum.Easy)
      .setParameter('medium', DifficultyLevelEnum.Intermediate)
      .setParameter('hard', DifficultyLevelEnum.Advanced);
    // Now handle attempts separately
    if (userId) {
      // Raw historical totals (every attempt ever, retries included) — the "journey"
      // stats. Never used for accuracy/completion/score/leaderboard (that's the
      // latest-attempt join below) — these exist purely so a user's full effort/struggle
      // is still visible somewhere, since the mastery-based fields intentionally can't
      // distinguish "got it right first try" from "got it right on attempt #12."
      qb.leftJoin(
        (subQ) => {
          return subQ
            .select('qa.questionId', 'questionId')
            .addSelect('COUNT(*)', 'attempts')
            .addSelect('SUM(CASE WHEN qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correct')
            .addSelect(
              'SUM(CASE WHEN qa.isCorrect = 0 AND qa.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
              'wrong',
            )
            .from('question_attempt', 'qa')
            .where('qa.userId = :userId', { userId })
            .groupBy('qa.questionId');
        },
        'rawAttempts',
        'rawAttempts.questionId = q.id',
      )
        .addSelect('COALESCE(SUM(rawAttempts.attempts), 0)', 'numMyAttempts')
        .addSelect('COALESCE(SUM(rawAttempts.correct), 0)', 'journeyCorrect')
        .addSelect('COALESCE(SUM(rawAttempts.wrong), 0)', 'journeyWrong');

      // Latest attempt per (user, question) — mirrors SubjectStatsService's approach so
      // correct/wrong/coverage mean "current standing," not raw historical totals. A
      // question resubmitted via a new quiz after being answered wrong before only
      // counts here as whatever its MOST RECENT attempt was, so this can't be inflated
      // by retrying (nor deflated by an old mistake that's since been corrected).
      const latestAttemptSub = this.dataSource
        .createQueryBuilder()
        .subQuery()
        .select('qa2.questionId', 'questionId')
        .addSelect('MAX(qa2.id)', 'maxId')
        .from('question_attempt', 'qa2')
        .where('qa2.userId = :userId', { userId })
        .groupBy('qa2.questionId')
        .getQuery();

      qb.leftJoin(`(${latestAttemptSub})`, 'la', 'la.questionId = q.id')
        .leftJoin('question_attempt', 'qa', 'qa.id = la.maxId')
        .addSelect('COUNT(DISTINCT qa.questionId)', 'myDistinctQuestions')
        // No separate "distinct correct questions" count needed: question_topic is
        // unique on (questionId, topicId), so within one topic's grouped rows each
        // question contributes at most one latest-attempt row — myCorrect (a SUM of
        // isCorrect flags) is therefore already equal to a distinct-correct-question
        // count, same as myDistinctQuestions already is for "attempted."
        .addSelect('SUM(CASE WHEN qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'myCorrect')
        .addSelect(
          'SUM(CASE WHEN qa.isCorrect = 0 AND qa.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
          'myWrong',
        )
        .addSelect('SUM(CASE WHEN q.level = :easy AND qa.id IS NOT NULL THEN 1 ELSE 0 END)', 'attemptedEasy')
        .addSelect('SUM(CASE WHEN q.level = :medium AND qa.id IS NOT NULL THEN 1 ELSE 0 END)', 'attemptedMedium')
        .addSelect('SUM(CASE WHEN q.level = :hard AND qa.id IS NOT NULL THEN 1 ELSE 0 END)', 'attemptedHard')
        .addSelect('SUM(CASE WHEN q.level = :easy AND qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correctEasy')
        .addSelect('SUM(CASE WHEN q.level = :medium AND qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correctMedium')
        .addSelect('SUM(CASE WHEN q.level = :hard AND qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correctHard')
        .addSelect(
          'SUM(CASE WHEN q.level = :easy AND qa.isCorrect = 0 AND qa.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
          'wrongEasy',
        )
        .addSelect(
          'SUM(CASE WHEN q.level = :medium AND qa.isCorrect = 0 AND qa.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
          'wrongMedium',
        )
        .addSelect(
          'SUM(CASE WHEN q.level = :hard AND qa.isCorrect = 0 AND qa.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
          'wrongHard',
        );
    } else {
      qb.addSelect('0', 'numMyAttempts')
        .addSelect('0', 'journeyCorrect')
        .addSelect('0', 'journeyWrong')
        .addSelect('0', 'myCorrect')
        .addSelect('0', 'myWrong')
        .addSelect('0', 'myDistinctQuestions')
        .addSelect('0', 'attemptedEasy')
        .addSelect('0', 'attemptedMedium')
        .addSelect('0', 'attemptedHard')
        .addSelect('0', 'correctEasy')
        .addSelect('0', 'correctMedium')
        .addSelect('0', 'correctHard')
        .addSelect('0', 'wrongEasy')
        .addSelect('0', 'wrongMedium')
        .addSelect('0', 'wrongHard');
    }

    qb.groupBy('t.id');

    // Non-admin users can only see topics under subscribed subjects.
    if (
      user &&
      typeof user === 'object' &&
      user.role !== UserRoleEnum.ADMIN &&
      userId
    ) {
      qb.innerJoin(
        'user_subject',
        'us',
        'us.subjectId = t.subjectId AND us.userId = :subscriptionUserId',
        { subscriptionUserId: userId },
      );
    }

    return qb;
  }

  /** Map a raw row from base QB to the response shape (calculates derived fields in TS). */
  private mapTopicRow(raw: any) {
    const numLessons = 0;
    const numTrivia = +raw.numTrivia || 0;
    const totalAttempts = +raw.totalAttempts || 0;
    const numMyAttempts = +raw.numMyAttempts || 0;
    const journeyCorrect = +raw.journeyCorrect || 0;
    const journeyWrong = +raw.journeyWrong || 0;
    const myCorrect = +raw.myCorrect || 0;
    const myWrong = +raw.myWrong || 0;
    const myDistinctQuestions = +raw.myDistinctQuestions || 0;
    const attemptedEasy = +raw.attemptedEasy || 0;
    const attemptedMedium = +raw.attemptedMedium || 0;
    const attemptedHard = +raw.attemptedHard || 0;
    const correctEasy = +raw.correctEasy || 0;
    const correctMedium = +raw.correctMedium || 0;
    const correctHard = +raw.correctHard || 0;
    const wrongEasy = +raw.wrongEasy || 0;
    const wrongMedium = +raw.wrongMedium || 0;
    const wrongHard = +raw.wrongHard || 0;
    const isStarted = numMyAttempts > 0;
    // Completion requires actually answering correctly, not just attempting — coverage
    // must never gate completion/certification on its own (see TOPIC_DONE's usage in
    // SubjectTrackAnalysisService for the same rule). computeAttemptMetrics() is the one
    // shared implementation of this whole formula — see its doc comment for why.
    const {
      coverage, correctCoverage, currentAccuracy, score, journeyAccuracy, journeyScore,
    } = computeAttemptMetrics({
      numTrivia,
      attempted: myDistinctQuestions,
      correct: myCorrect,
      wrong: myWrong,
      journeyAttempts: numMyAttempts,
      journeyCorrect,
      journeyWrong,
    });
    const isCompleted = correctCoverage >= TOPIC_DONE;
    // userLevel needs correctCoverage (above) to cap an over-confident accuracy-only
    // read — see getAggregateUserLevel's doc comment.
    const userLevel = getAggregateUserLevel(
      attemptedEasy, correctEasy,
      attemptedMedium, correctMedium,
      attemptedHard, correctHard,
      correctCoverage,
    );

    const topicsList = {
      id: +raw.topicId,
      title: raw.topicTitle,
      slug: raw.slug,
      label: raw.label,
      description: raw.topicDesc,
      goal: raw.goal,
      subjectId: +raw.subjectId,
      subjectName: raw?.subjectName,
      numTrivia,
      numBasicTrivia: +raw?.numBasicTrivia || 0,
      numIntTrivia: +raw?.numIntTrivia || 0,
      numAdvTrivia: +raw?.numAdvTrivia || 0,
      numLessons,
      totalAttempts,
      // Named to match subject/subjectTrack level exactly (previously myAllAttempts/
      // myUniqueAttempts here specifically) — same two concepts, one name each, everywhere.
      journeyAttempts: numMyAttempts,
      attempted: myDistinctQuestions,
      correct: myCorrect,
      wrong: myWrong,
      journeyCorrect,
      journeyWrong,
      journeyAccuracy,
      journeyScore,
      attemptedEasy,
      attemptedMedium,
      attemptedHard,
      correctEasy,
      correctMedium,
      correctHard,
      wrongEasy,
      wrongMedium,
      wrongHard,
      userLevel,
      currentAccuracy,
      score,
      isStarted,
      isCompleted,
      meritList: null,
      coverage,
      correctCoverage,
    };
    return topicsList;
  }

  /** Get stats for ALL topics under ONE subject (single grouped query). */
  async getTopicStatsBySubject(subjectId: number, user?: GetUserRequestDto | number) {
    const userId = typeof user === 'number' ? user : user?.id;
    const qb = this.buildTopicStatsBaseQB(userId, user).where(
      't.subjectId = :subjectId',
      { subjectId },
    );

    const raws = await qb.getRawMany();
    return raws.map((r) => this.mapTopicRow(r));
  }

  /** Get stats for ALL topics. Optionally pass pagination. */
  async getAllTopicStats(
    user?: GetUserRequestDto | number,
    offset = 0,
    limit = 300,
  ) {
    const userId = typeof user === 'number' ? user : user?.id;
    const qb = this.buildTopicStatsBaseQB(userId, user)
      .offset(offset)
      .limit(limit);

    const raws = await qb.getRawMany();
    return raws.map((r) => this.mapTopicRow(r));
  }

  /** Get stats for a specific set of topic IDs — used by the career dashboard. */
  async getTopicStatsByIds(topicIds: number[], userId?: number) {
    if (!topicIds.length) return [];
    const qb = this.buildTopicStatsBaseQB(userId).where(
      't.id IN (:...topicIds)',
      { topicIds },
    );
    const raws = await qb.getRawMany();
    return raws.map((r) => this.mapTopicRow(r));
  }

}
