import {
  HttpStatus,
  Injectable
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { DataSource, In, Repository } from 'typeorm';
import { GetQuestionsByIdsDto } from '../dtos/get-questions-by-ids.dto';
import { QuestionListResponseDto } from '../dtos/question-list-response.dto';
@Injectable()
export class UserQuestionService {
  constructor(
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    private readonly dataSource: DataSource
  ) { }

  async getUniqueQuizForQuestions(
    userId: number,
    dto: GetQuestionsByIdsDto
  ): Promise<QuestionListResponseDto[]> {

    const { subjectIds = [], topicIds = [], subjectTrackIds = [], numQuestions = 10 } = dto;
    let msg: string = 'unique';
    if (subjectIds.length === 0 && topicIds.length === 0 && subjectTrackIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'At least one of subjects, topics, or subjectTracks must be provided.'
      );
    }

    // A quiz can be requested by subject, topic, and/or subjectTrack at once — these
    // combine (union of topics), they don't override each other. Everything is
    // resolved down to one topic-level pool so a single partitioning/fairness scheme
    // (one ROW_NUMBER group per topic) applies no matter which scope(s) were asked for,
    // instead of subject-scoped quizzes getting a coarser, topic-imbalance-prone
    // per-subject partition.
    const groupIds = await this.resolveTopicIds(subjectIds, topicIds, subjectTrackIds);
    if (groupIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        'No published topics found for the given subject(s)/topic(s)/subjectTrack(s).'
      );
    }
    const perGroupCount = Math.ceil(numQuestions / groupIds.length);
    const groupIdList = groupIds.map(() => '?').join(',');

    let uniqueQuestions = await this.getUniqueQuestions(groupIdList, userId, groupIds, perGroupCount);

    // let uniqueQuestions = rawResults;

    if (uniqueQuestions.length < numQuestions) {
      // 2nd part
      const missingCount = numQuestions - uniqueQuestions.length;
      const existingIds = uniqueQuestions.map(q => q.questionId);

      // Avoid empty IN () issues by falling back to [0]
      const listOfExistingIds = existingIds.length ? existingIds : [0];

      const randomQuestions = await this.getRandomQuestions(groupIdList, userId, groupIds, listOfExistingIds, missingCount);

      uniqueQuestions = [...uniqueQuestions, ...randomQuestions];
      // uniqueQuestions = [...new Map([...uniqueQuestions, ...randomQuestions].map((q:any) => [q.questionId, q])).values()];
      msg = 'random';
    }

    if (uniqueQuestions && uniqueQuestions.length == 0) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Not enough ${msg} questions available. Found ${uniqueQuestions.length}, need ${numQuestions}.`
      );
    }

    // Step 4: Fetch relations (options, topics) for mapping
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
    // Quiz created successfully
    const response: any = {
      message: `Quiz created successfully with ${msg} questions.`,
      questions: this.mappedQuestionList(uniqueQuestions, topicsMap, optionsMap),
    }
    return response;

  }

  //Also in question.service
  private mappedQuestionList(
    questions: Question[],
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
      //topics: q.questionTopics,
      //options: q.options,
      // userCreatedBy: q?.userCreatedBy
      //   ? {
      //     id: q.userCreatedBy.id,
      //     firstName: q.userCreatedBy.firstName,
      //     lastName: q.userCreatedBy.lastName,
      //     email: q.userCreatedBy.email,
      //   }
      //   : null,
    }));
  }


  /**
   * Resolves subjectIds/topicIds/subjectTrackIds down to one deduplicated set of
   * topicIds: subjects and subjectTracks are expanded to their member topics
   * (published only), explicit topicIds pass through as-is. This is what lets
   * question selection always partition per-topic — a Subject or SubjectTrack quiz
   * gets the same per-topic fairness a Topic quiz already had, instead of treating
   * the whole subject/track as one undifferentiated pool.
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

  private async getUniqueQuestions(groupIdList: any, userId: any, groupIds: any,
    perGroupCount: any): Promise<any[]> {

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
          -- Never-attempted questions fill each group's quota before previously-wrong
          -- ones get a repeat chance, so a small pool's handful of missed questions can't
          -- dominate every "unique" quiz purely by RAND() luck.
          ROW_NUMBER() OVER (
            PARTITION BY qt.topicId
            ORDER BY CASE WHEN aq.questionId IS NOT NULL THEN 1 ELSE 0 END ASC, RAND()
          ) as rn

        FROM question q

        LEFT JOIN subject s ON s.id = q.subjectId
        INNER JOIN question_topic qt ON qt.questionId = q.id
        LEFT JOIN topic t ON t.id = qt.topicId
        LEFT JOIN attempted_questions aq ON aq.questionId = q.id

        WHERE q.questionType = 'Trivia'
          AND q.status = 'Active'
          AND qt.topicId IN (${groupIdList})
          AND NOT EXISTS (
            SELECT 1 FROM correct_questions cq WHERE cq.questionId = q.id
          )
      )
      SELECT *
      FROM grouped_questions
      WHERE rn <= ?
      ORDER BY level, groupId, RAND()
      `;
    const params = [
      userId,
      userId,
      ...groupIds,
      perGroupCount
    ];
    return this.dataSource.query(rawQuery, params);
  }
  private async getRandomQuestions(groupIdList: any, userId: any, groupIds: any,
    listOfExistingIds: any, missingCount: any): Promise<any[]> {

    const params2 = [
      userId,                     // attempted_questions subquery, for priority ordering
      QuestionTypeEnum.Trivia,         // questionType
      QuestionStatusEnum.Active,       // status
      userId,                     // already selected
      listOfExistingIds,                 // existingIds from earlier selection
      ...groupIds,
      missingCount                     // limit
    ];
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

      -- Same never-attempted-first priority as getUniqueQuestions() above.
      ORDER BY q.level, (aq.questionId IS NOT NULL) ASC, RAND()
      LIMIT ?;
  `;
    return this.dataSource.query(
      query2,
      params2
    );
  }


}
