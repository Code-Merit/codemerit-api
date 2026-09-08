import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { validate } from 'class-validator';
import { QualityReviewOutcomeEnum } from 'src/common/enum/quality-review-outcome.enum';
import { QualityResourceTypeEnum } from 'src/common/enum/quality-resource-type.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QualityMetric } from 'src/common/typeorm/entities/quality-metric.entity';
import { QualityReview } from 'src/common/typeorm/entities/quality-review.entity';
import { QualityReviewTag } from 'src/common/typeorm/entities/quality-review-tag.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuestionTopic } from 'src/common/typeorm/entities/quesion-topic.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { shuffleArray } from 'src/common/utils/common-functions';
import {
  generateSlug,
  generateUniqueSlug,
} from 'src/common/utils/slugify.util';
import { GetUserRequestDto } from 'src/core/auth/dto/get-user-request.dto';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AdminQuestionResponseDto } from '../dtos/admin-question-response.dto';
import { CreateOptionDto } from '../dtos/create-option.dto';
import { CreateQuestionDto } from '../dtos/create-question.dto';
import { GetQuestionsByIdsDto } from '../dtos/get-questions-by-ids.dto';
import { QuestionListResponseDto } from '../dtos/question-list-response.dto';
import { UpdateQuestionDto } from '../dtos/update-question.dto';
import { QuestionOptionService } from './question-option.service';

export interface QuestionListFilters {
  fullData?: boolean;
  subjectId?: number;
  subjectSlug?: string;
  topicId?: number;
  topicSlug?: string;
  level?: number;
  status?: QuestionStatusEnum;
  isWhitelisted?: boolean;
  authorId?: number;
  // Reads the denormalized rollup columns on Question (updated only when a
  // QualityReview is submitted) — no join to quality_review needed, same
  // reasoning as QuestionQualityService.getReviewQueue's unreviewed/flagged split.
  qualityFilter?: 'unreviewed' | 'needsAttention' | 'approved';
  // Resolves to a quality_metric row via its stable `code` (never a raw numeric id
  // on the wire) — matches questions whose LATEST SUBMITTED review has that specific
  // issue/positive tag attached, same "latest review per question" technique as
  // QuestionQualityService.getFlaggedForRevision/getTopIssueTags.
  tagCode?: string;
  // Questions with zero rows in question_attempt — same definition as
  // QuestionQualityService.getNeverAttempted, expressed as a correlated NOT EXISTS
  // so it composes with the other WHERE-only filters here without a GROUP BY.
  neverAttempted?: boolean;
  fetchAll?: boolean;
  limit?: number;
  user?: GetUserRequestDto;
  // Admin OR LmsManager-permission holder — both get full, unscoped visibility.
  // Computed once by the controller (it already has to check this for the 403
  // gate) rather than re-derived here from `user.role` alone.
  hasFullAccess?: boolean;
}

@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Question)
    private questionRepo: Repository<Question>,
    private readonly dataSource: DataSource,
    private readonly questionOptionService: QuestionOptionService,
  ) {}

  findAll() {
    return this.questionRepo.find();
  }

  findOne(id: number) {
    return this.questionRepo.findOne({ where: { id } });
  }

  findOneWithAuidt(id: number) {
    return this.questionRepo.findOne({
      where: { id },
      select: [
        'id',
        'createdBy',
        'updatedBy',
        'questionType',
        'status',
        'isWhitelisted',
      ],
    });
  }

  async findOneBySlug(slug: string) {
    const question = await this.questionRepo.findOne({
      where: { slug },
      relations: [
        'options',
        'questionTopics',
        'questionTopics.topic',
        'userCreatedBy',
        'subject',
      ],
    });

    // Build topic list
    const topics = question.questionTopics.map((qt) => ({
      id: qt.topic.id,
      title: qt.topic.title,
    }));

    const subjectTitle = question.subject?.title ?? null;
    const userCreatedBy = question.userCreatedBy
      ? {
          id: question.userCreatedBy.id,
          firstName: question.userCreatedBy.firstName,
          lastName: question.userCreatedBy.lastName,
          email: question.userCreatedBy.email,
          username: question.userCreatedBy.username,
        }
      : null;

    // Destructure to remove questionTopics and userCreatedBy from the base object
    const { questionTopics, userCreatedBy: _, ...rest } = question;

    // Final output object
    const questionWithTopics = {
      ...rest,
      topics,
      userCreatedBy,
      subjectTitle: subjectTitle,
    };
    return questionWithTopics;
  }

  async remove(id: number, user: GetUserRequestDto, hasFullAccess = false) {
    const question = await this.findOneWithAuidt(id);
    if (question) {
      // Whitelisted questions: Admin or LmsManager only — equivalent access.
      if (
        question['isWhitelisted'] &&
        user.role !== UserRoleEnum.ADMIN &&
        !hasFullAccess
      ) {
        throw new AppCustomException(
          HttpStatus.FORBIDDEN,
          'This question is whitelisted and can only be deleted by administrators.',
        );
      }

      if (
        user.role == UserRoleEnum.ADMIN ||
        hasFullAccess ||
        (user.role == UserRoleEnum.MODERATOR && user.id == question?.createdBy)
      ) {
        await this.dataSource.transaction(async (manager) => {
          await manager.delete(QuestionOption, { questionId: question.id });
          await manager.delete(QuestionTopic, { questionId: question.id });
          await manager.delete(Question, { id: question.id });
        });
      } else {
        throw new AppCustomException(
          HttpStatus.NOT_FOUND,
          `User dont have permission to delete.`,
        );
      }
    } else {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Question not found.`);
    }
    // await this.questionRepo.delete(id);
    // return { deleted: true };
  }

  async updateQuestion(
    id: number,
    dto: UpdateQuestionDto,
    user: GetUserRequestDto,
    hasFullAccess = false,
  ): Promise<Question> {
    if (!dto.questionType) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `Question Type is required`,
      );
    }
    if (!dto.subjectId) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `Question subject is required`,
      );
    }
    // if (!dto.topicIds || dto.topicIds.length <= 0) {
    //   throw new AppCustomException(
    //     HttpStatus.BAD_REQUEST,
    //     `Question topic is required`+dto.topicIds,
    //   );
    // }

    const questionAdut = await this.findOneWithAuidt(id);

    // Whitelisted questions: Admin or LmsManager only — equivalent access.
    if (
      questionAdut['isWhitelisted'] &&
      user.role !== UserRoleEnum.ADMIN &&
      !hasFullAccess
    ) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'This question is whitelisted and can only be modified by administrators.',
      );
    }

    if (
      user.role == UserRoleEnum.MODERATOR &&
      user.id !== questionAdut?.createdBy
    ) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `User dont have permission to update this question.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();
    let msg = '';
    try {
      const question = await this.findOne(id);

      if (!question) {
        msg = `Question with id ${id} not found`;
        throw new BadRequestException();
      }
      const updatedQuestion = this.questionRepo.merge(question, dto);

      const { options, ...questionData } = updatedQuestion;
      const savedQuestion = await queryRunner.manager.save(
        Question,
        questionData,
      );

      if (dto?.topicIds && dto.topicIds.length > 0) {
        const existingTopics = await queryRunner.manager.find(QuestionTopic, {
          where: { questionId: savedQuestion.id },
        });

        const staleTopicIds = existingTopics
          .map((qt) => qt.topicId)
          .filter((id) => !dto.topicIds.includes(id));

        if (staleTopicIds.length > 0) {
          await queryRunner.manager.delete(QuestionTopic, {
            questionId: savedQuestion.id,
            topicId: In(staleTopicIds),
          });
        }

        const existingTopicIds = new Set(
          existingTopics.map((qt) => qt.topicId),
        );

        const newTopicIds = dto.topicIds.filter(
          (id) => !existingTopicIds.has(id),
        );

        const newTopics = newTopicIds.map((topicId) => ({
          topicId,
          questionId: savedQuestion.id,
        }));
        if (newTopicIds.length > 0) {
          await this.saveQuestionTopic(
            queryRunner.manager,
            newTopicIds,
            savedQuestion.id,
          );
        }
      }

      if (dto.questionType !== QuestionTypeEnum.General) {
        if (dto.options?.length >= 2) {
          const hasCorrectOption = dto.options.some(
            (opt: CreateOptionDto) => opt.correct === true,
          );
          if (!hasCorrectOption) {
            msg = 'At least one option must be marked as correct.';
            throw new BadRequestException();
          }
          await this.saveOption(
            queryRunner.manager,
            dto?.options,
            savedQuestion.id,
          );
        } else {
          msg = 'At least 2 options are mendatory for selected question type';
          throw new BadRequestException();
        }
      } else {
        await queryRunner.manager.delete(QuestionOption, {
          questionId: savedQuestion?.id,
        });
      }
      // if (dto?.options && dto.options?.length > 0) {
      //   if (dto.questionType !== QuestionTypeEnum.General) {

      //     await this.saveOption(
      //       queryRunner.manager,
      //       dto?.options,
      //       savedQuestion.id,
      //     );
      //   } else {
      //     await queryRunner.manager.delete(QuestionOption, {
      //       questionId: savedQuestion?.id,
      //     });
      //   }
      // }

      await queryRunner.commitTransaction();
      return savedQuestion;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        msg ? msg : error.detail || error.message || error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async createQuestion(dto: CreateQuestionDto): Promise<Question> {
    const queryRunner = this.dataSource.createQueryRunner();
    let msg = '';
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const questionEntity = this.questionRepo.create(dto);
      const errors = await validate(questionEntity);
      if (errors.length) {
        msg = 'Failed to create question => ' + errors.toString();
        throw new BadRequestException();
      }

      let slug = generateSlug(dto.question);
      let existing = await this.questionRepo.findOne({ where: { slug } });
      while (existing) {
        slug = generateUniqueSlug(dto.question);
        existing = await this.questionRepo.findOne({ where: { slug } });
      }
      questionEntity.slug = slug;
      const savedQuestion = await queryRunner.manager.save(
        Question,
        questionEntity,
      );

      if (savedQuestion) {
        if (dto?.topicIds && dto?.topicIds?.length > 0) {
          await this.saveQuestionTopic(
            queryRunner.manager,
            dto?.topicIds,
            savedQuestion.id,
          );
        } else {
          msg = 'Topics are mendatory';
          throw new BadRequestException();
        }
        if (dto.questionType !== QuestionTypeEnum.General) {
          if (dto.options?.length >= 2) {
            const hasCorrectOption = dto.options.some(
              (opt: CreateOptionDto) => opt.correct === true,
            );
            if (!hasCorrectOption) {
              msg = 'At least one option must be marked as correct.';
              throw new BadRequestException();
            }
            await this.saveOption(
              queryRunner.manager,
              dto?.options,
              savedQuestion.id,
            );
          } else {
            msg = 'At least 2 options are mendatory for selected question type';
            throw new BadRequestException();
          }
        }
      }
      await queryRunner.commitTransaction();
      return this.findOne(savedQuestion.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        msg ? msg : error.detail || error.message || error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getQuestionListForAdmin(
    filters: QuestionListFilters,
  ): Promise<AdminQuestionResponseDto[]> {
    // An empty result is not an error — a valid filter combination that legitimately
    // matches nothing (e.g. a non-Admin caller's own authored count for that subject
    // is zero) is a normal 200 with `data: []`, not a 404. The 404 this used to throw
    // here conflated "found nothing" with "the resource doesn't exist" and made the
    // controller's own graceful empty-list handling permanently unreachable. Slug
    // lookups that can't resolve at all (see fetchAllLatestQuestions below) still
    // throw a specific, real 404 — that IS a "the thing you referenced doesn't exist"
    // case, unlike an empty-but-valid query.
    return (await this.fetchAllLatestQuestions(filters)) ?? [];
  }

  async fetchAllLatestQuestions(
    filters: QuestionListFilters,
  ): Promise<any[] | undefined> {
    const {
      fullData = false,
      subjectId,
      subjectSlug,
      topicId,
      topicSlug,
      level,
      status,
      isWhitelisted,
      authorId,
      qualityFilter,
      tagCode,
      neverAttempted,
      fetchAll = false,
      limit = 100,
      user,
      hasFullAccess = false,
    } = filters;

    // Slugs are resolved here (not passed straight through as ids) so the URL never
    // has to carry a raw subject/topic id — mirrors SubjectStatsService.getSubjectPage's
    // slug->id lookup. Unlike an empty-but-valid result set, a slug that doesn't
    // resolve to anything IS a genuine "the thing you referenced doesn't exist" —
    // a real 404 with a specific message (e.g. a typo'd slug), not a silent empty list.
    let resolvedSubjectId = subjectId;
    if (!resolvedSubjectId && subjectSlug) {
      const subject = await this.dataSource
        .getRepository(Subject)
        .findOne({ where: { slug: subjectSlug }, select: ['id'] });
      if (!subject) {
        throw new AppCustomException(
          HttpStatus.NOT_FOUND,
          `No subject found for slug "${subjectSlug}".`,
        );
      }
      resolvedSubjectId = subject.id;
    }

    let resolvedTopicId = topicId;
    if (!resolvedTopicId && topicSlug) {
      const topic = await this.dataSource
        .getRepository(Topic)
        .findOne({ where: { slug: topicSlug }, select: ['id'] });
      if (!topic) {
        throw new AppCustomException(
          HttpStatus.NOT_FOUND,
          `No topic found for slug "${topicSlug}".`,
        );
      }
      resolvedTopicId = topic.id;
    }

    let resolvedTagId: number | undefined;
    if (tagCode) {
      const tag = await this.dataSource
        .getRepository(QualityMetric)
        .findOne({ where: { code: tagCode }, select: ['id'] });
      if (!tag) {
        throw new AppCustomException(
          HttpStatus.NOT_FOUND,
          `No quality tag found for code "${tagCode}".`,
        );
      }
      resolvedTagId = tag.id;
    }

    // Step 1: fetch limited question IDs
    const idQb = this.questionRepo
      .createQueryBuilder('q')
      .select('q.id', 'id')
      .orderBy('q.id', 'DESC');

    if (!hasFullAccess && (!user || user.role !== UserRoleEnum.ADMIN)) {
      idQb.andWhere('q.createdBy = :createdBy', {
        createdBy: user?.id ?? 0,
      });
    }

    if (resolvedSubjectId) {
      idQb.andWhere('q.subjectId = :subjectId', { subjectId: resolvedSubjectId });
    }

    if (resolvedTopicId) {
      idQb
        .innerJoin('q.questionTopics', 'qt')
        .andWhere('qt.topicId = :topicId', { topicId: resolvedTopicId });
    }

    if (level) {
      idQb.andWhere('q.level = :level', { level });
    }

    if (status) {
      idQb.andWhere('q.status = :status', { status });
    }

    if (isWhitelisted !== undefined) {
      idQb.andWhere('q.isWhitelisted = :isWhitelisted', { isWhitelisted });
    }

    if (authorId > 0) {
      idQb.andWhere('q.createdBy = :authorId', { authorId });
    }

    if (qualityFilter === 'unreviewed') {
      idQb.andWhere('q.reviewCount = 0');
    } else if (qualityFilter === 'needsAttention') {
      idQb.andWhere('q.lastReviewOutcome IN (:...needsAttentionOutcomes)', {
        needsAttentionOutcomes: [
          QualityReviewOutcomeEnum.NeedsRevision,
          QualityReviewOutcomeEnum.Rejected,
        ],
      });
    } else if (qualityFilter === 'approved') {
      idQb.andWhere('q.lastReviewOutcome = :approvedOutcome', {
        approvedOutcome: QualityReviewOutcomeEnum.Approved,
      });
    }

    if (resolvedTagId) {
      // "Latest review per question" — MAX(updatedAt), not MAX(id): a review row can now be
      // updated in place (same reviewer editing their own pass), so an older-id row can
      // become the most recently touched one. MAX(id) would silently pick the wrong row
      // once that happens. QualityReviewTag doesn't carry resourceId directly, so join
      // QualityReview on (resourceId, updatedAt) first, then join the tag through its id.
      // No status filter needed — every quality_review row is already a final decision.
      const latestReviewSub = this.dataSource
        .createQueryBuilder()
        .subQuery()
        .select('r2.resourceId', 'resourceId')
        .addSelect('MAX(r2.updatedAt)', 'maxUpdatedAt')
        .from(QualityReview, 'r2')
        .where('r2.resourceType = :tagResourceType', {
          tagResourceType: QualityResourceTypeEnum.Question,
        })
        .groupBy('r2.resourceId')
        .getQuery();

      idQb
        .innerJoin(`(${latestReviewSub})`, 'latestReview', 'latestReview.resourceId = q.id')
        .innerJoin(
          QualityReview,
          'lr',
          'lr.resourceId = latestReview.resourceId AND lr.updatedAt = latestReview.maxUpdatedAt',
        )
        .innerJoin(QualityReviewTag, 'qrt', 'qrt.qualityReviewId = lr.id')
        .andWhere('qrt.qualityMetricId = :tagId', { tagId: resolvedTagId })
        .setParameter('tagResourceType', QualityResourceTypeEnum.Question);
    }

    if (neverAttempted) {
      const attemptSub = this.dataSource
        .createQueryBuilder()
        .subQuery()
        .select('1')
        .from(QuestionAttempt, 'qa')
        .where('qa.questionId = q.id')
        .getQuery();
      idQb.andWhere(`NOT EXISTS ${attemptSub}`);
    }

    if (!fetchAll) {
      idQb.take(limit);
    }

    const ids = (await idQb.getRawMany()).map((r) => r.id);
    if (!ids.length) return [];

    // Step 2: fetch full data
    const qb = this.questionRepo
      .createQueryBuilder('question')
      .whereInIds(ids)
      .orderBy('question.id', 'DESC')
      // question fields
      .select('question.id', 'question_id')
      .addSelect('question.title', 'question_title')
      .addSelect('question.question', 'question_text')
      .addSelect('question.subjectId', 'subjectId')
      .addSelect('question.level', 'level')
      .addSelect('question.slug', 'question_slug')
      .addSelect('question.questionType', 'questionType')
      .addSelect('question.status', 'status')
      .addSelect('question.timeAllowed', 'timeAllowed')
      .addSelect('question.tag', 'tag')
      .addSelect('question.orderId', 'orderId')
      .addSelect('question.marks', 'marks')
      .addSelect('question.hint', 'hint')
      .addSelect('question.answer', 'answer')
      .addSelect('question.isWhitelisted', 'isWhitelisted')
      .addSelect('question.createdAt', 'question_createdAt')
      .addSelect('question.reviewCount', 'reviewCount')
      .addSelect('question.latestGrade', 'latestGrade')
      .addSelect('question.lastReviewOutcome', 'lastReviewOutcome')
      // subject
      .leftJoin('question.subject', 'subject')
      .addSelect('subject.id', 'subject_id')
      .addSelect('subject.title', 'subject_title')
      // user
      .leftJoin('question.userCreatedBy', 'user')
      .addSelect('user.id', 'user_id')
      .addSelect('user.firstName', 'user_firstName')
      .addSelect('user.lastName', 'user_lastName')
      .addSelect('user.username', 'user_username')
      // topics
      .leftJoin('question.questionTopics', 'questionTopic')
      .leftJoin('questionTopic.topic', 'topic')
      .addSelect('topic.id', 'topic_id')
      .addSelect('topic.title', 'topic_title');

    // options (with raw aliases)
    if (fullData) {
      qb.leftJoin('question.options', 'options')
        .addSelect('options.id', 'option_id')
        .addSelect('options.option', 'option_text')
        .addSelect('options.correct', 'option_correct');
    }

    const raws = await qb.getRawMany();

    // group rows into questions
    const map = new Map<number, any>();

    for (const row of raws) {
      const qid = row['question_id'];
      if (!map.has(qid)) {
        map.set(qid, {
          id: qid,
          title: row['question_title'] ?? null,
          question: row['question_text'] ?? null,
          slug: row['question_slug'] ?? null,
          //map details
          subjectId: row['subjectId'] ?? null,
          questionType: row['questionType'] ?? null,
          level: row['level'] ?? null,
          status: row['status'] ?? null,
          timeAllowed: row['timeAllowed'] ?? null,
          tag: row['tag'] ?? null,
          marks: row['marks'] ?? null,
          orderId: row['orderId'] ?? null,
          hint: row['hint'] ?? null,
          answer: row['answer'] ?? null,
          isWhitelisted: row['isWhitelisted'] ?? false,
          reviewCount: row['reviewCount'] ?? 0,
          latestGrade: row['latestGrade'] ?? null,
          lastReviewOutcome: row['lastReviewOutcome'] ?? null,
          //map other fields
          createdAt: row['question_createdAt'] ?? null,
          subject: row['subject_id']
            ? { id: row['subject_id'], title: row['subject_title'] }
            : null,
          userCreatedBy: row['user_id']
            ? {
                id: row['user_id'],
                firstName: row['user_firstName'],
                lastName: row['user_lastName'],
                username: row['user_username'],
              }
            : null,
          topics: [],
          options: [],
        });
      }

      const qObj = map.get(qid);

      // add topic
      if (row['topic_id']) {
        if (!qObj.topics.some((t: any) => t.id === row['topic_id'])) {
          qObj.topics.push({ id: row['topic_id'], title: row['topic_title'] });
        }
      }

      // add option
      if (fullData && row['option_id']) {
        if (!qObj.options.some((o: any) => o.id === row['option_id'])) {
          qObj.options.push({
            id: row['option_id'],
            option: row['option_text'],
            correct: !!row['option_correct'],
          });
        }
      }
    }

    return Array.from(map.values());
  }

  async getQuestionAuthors(): Promise<Array<{ id: number; name: string }>> {
    const rows = await this.questionRepo
      .createQueryBuilder('q')
      .innerJoin('q.userCreatedBy', 'u')
      .select('u.id', 'id')
      .addSelect(
        "CONCAT(COALESCE(u.firstName, ''), ' ', COALESCE(u.lastName, ''))",
        'name',
      )
      .groupBy('u.id')
      .addGroupBy('u.firstName')
      .addGroupBy('u.lastName')
      .orderBy('u.firstName', 'ASC')
      .addOrderBy('u.lastName', 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name || '').trim(),
    }));
  }

  async getQuizBuilderQuestions(
    subjectIds?: number[],
    topicIds?: number[],
    level?: number,
  ): Promise<
    Array<{
      questionid: number;
      question: string;
      subjectid: number;
      subject: string;
      topicid: number;
      topic: string;
      level: number;
    }>
  > {
    const qb = this.questionRepo
      .createQueryBuilder('question')
      .innerJoin('question.subject', 'subject')
      .innerJoin('question.questionTopics', 'questionTopic')
      .innerJoin('questionTopic.topic', 'topic')
      .select('question.id', 'questionid')
      .addSelect('question.question', 'question')
      .addSelect('subject.id', 'subjectid')
      .addSelect('subject.title', 'subject')
      .addSelect('topic.id', 'topicid')
      .addSelect('topic.title', 'topic')
      .addSelect('question.level', 'level')
      .where('question.status = :status', {
        status: QuestionStatusEnum.Active,
      })
      .orderBy('question.id', 'DESC');

    if (subjectIds && subjectIds.length > 0) {
      qb.andWhere('question.subjectId IN (:...subjectIds)', {
        subjectIds,
      });
    }

    if (topicIds && topicIds.length > 0) {
      qb.andWhere('questionTopic.topicId IN (:...topicIds)', {
        topicIds,
      });
    }

    if (level) {
      qb.andWhere('question.level = :level', { level });
    }

    const rows = await qb.getRawMany();

    return rows.map((row) => ({
      questionid: Number(row.questionid),
      question: row.question,
      subjectid: Number(row.subjectid),
      subject: row.subject,
      topicid: Number(row.topicid),
      topic: row.topic,
      level: Number(row.level),
    }));
  }

  private async saveOption(
    manager: EntityManager,
    optionsDtoList: CreateOptionDto[],
    questionId: number,
  ) {
    let optionList: QuestionOption[] = [];
    for (const optionObj of optionsDtoList) {
      let option = new QuestionOption();
      if (optionObj?.id) {
        option.id = optionObj?.id;
      }
      option.option = optionObj.option;
      option.correct = optionObj.correct;
      option.comment = optionObj.comment;
      option.questionId = questionId;

      optionList.push(option);
    }
    await this.questionOptionService.createWithQuestionId(manager, optionList);
  }

  private async saveQuestionTopic(
    manager: EntityManager,
    topicIds: number[],
    questionId: number,
  ) {
    let questionList: QuestionTopic[] = [];
    for (const topicId of topicIds) {
      const topic = new QuestionTopic();
      topic.questionId = questionId;
      topic.topicId = topicId;
      questionList.push(topic);
    }
    await manager.save(QuestionTopic, questionList);
  }

  async getQuestionsByIds(
    dto: GetQuestionsByIdsDto,
  ): Promise<QuestionListResponseDto[]> {
    const {
      subjectIds = [],
      topicIds = [],
      numQuestions: numberOfQuestions,
    } = dto;

    if (subjectIds.length === 0 && topicIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'At least one of the subjects or topics must be provided.',
      );
    }

    const isTopicBased = topicIds.length > 0;
    const groupIds = isTopicBased ? topicIds : subjectIds;
    const perGroupCount = Math.ceil(numberOfQuestions / groupIds.length);

    // Run queries in parallel for each group
    const groupPromises = groupIds.map((groupId) => {
      const qb = this.questionRepo
        .createQueryBuilder('question')
        .addSelect('RAND()', 'rand')
        .leftJoinAndSelect('question.subject', 'subject')
        .leftJoinAndSelect('question.options', 'options')
        .leftJoinAndSelect('question.questionTopics', 'qt')
        .leftJoinAndSelect('qt.topic', 'topic')
        .where('question.questionType = :type', {
          type: QuestionTypeEnum.Trivia,
        })
        .andWhere('question.status = :status', {
          status: QuestionStatusEnum.Active,
        })
        .take(perGroupCount)
        .orderBy('rand');

      if (isTopicBased) {
        qb.andWhere('qt.topicId = :groupId', { groupId });
      } else {
        qb.andWhere('question.subjectId = :groupId', { groupId });
      }

      return qb.getMany();
    });

    const groupResults = await Promise.all(groupPromises);
    let uniqueQuestions = [
      ...new Map(groupResults.flat().map((q) => [q.id, q])).values(),
    ];

    // Fallback if not enough questions
    if (uniqueQuestions.length < numberOfQuestions) {
      console.log(
        'QuizBuilder Query :: uniqueQuestions Not Enough',
        uniqueQuestions.length,
        numberOfQuestions,
      );
      const missingCount = numberOfQuestions - uniqueQuestions.length;
      const existingIds = uniqueQuestions.map((q) => q.id);
      console.log('QuizBuilder Query :: Fallback started', uniqueQuestions);

      const fallbackQb = this.questionRepo
        .createQueryBuilder('question')
        .addSelect('RAND()', 'rand')
        .leftJoinAndSelect('question.subject', 'subject')
        .leftJoinAndSelect('question.options', 'options')
        .leftJoinAndSelect('question.questionTopics', 'qt')
        .leftJoinAndSelect('qt.topic', 'topic')
        .where('question.questionType = :type', {
          type: QuestionTypeEnum.Trivia,
        })
        .andWhere('question.status = :status', {
          status: QuestionStatusEnum.Active,
        })
        .orderBy('rand')
        .take(missingCount);

      if (existingIds.length > 0) {
        fallbackQb.andWhere('question.id NOT IN (:...existingIds)', {
          existingIds,
        });
      }

      if (isTopicBased) {
        fallbackQb.andWhere('qt.topicId IN (:...topicIds)', { topicIds });
      } else {
        fallbackQb.andWhere('question.subjectId IN (:...subjectIds)', {
          subjectIds,
        });
      }

      const fallbackQuestions = await fallbackQb.getMany();
      console.log(
        'QuizBuilder Query :: Fallback Questions',
        fallbackQuestions.length,
        fallbackQuestions,
      );
      uniqueQuestions = [
        ...new Map(
          [...uniqueQuestions, ...fallbackQuestions].map((q) => [q.id, q]),
        ).values(),
      ];
      console.log('QuizBuilder Query :: uniqueQuestions Now', uniqueQuestions);
    }

    const finalQuestions = uniqueQuestions.slice(0, numberOfQuestions);

    if (finalQuestions.length < numberOfQuestions) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `Not enough Trivia questions found. Found ${finalQuestions.length}, need ${numberOfQuestions}.`,
      );
    }

    // Fetch relations in parallel
    const questionIds = finalQuestions.map((q) => q.id);

    const [options, questionTopics] = await Promise.all([
      this.dataSource
        .getRepository(QuestionOption)
        .find({ where: { questionId: In(questionIds) } }),
      this.dataSource
        .getRepository(QuestionTopic)
        .find({ where: { questionId: In(questionIds) }, relations: ['topic'] }),
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

    return this.mappedQuestionList(finalQuestions, topicsMap, optionsMap);
  }

  private mappedQuestionList(
    questions: Question[],
    topicsMap?: Map<number, any[]>,
    optionsMap?: Map<number, any[]>,
  ): any[] {
    return questions.map((q) => ({
      id: q.id,
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
      topics: topicsMap.get(q.id) || [],
      options: optionsMap.get(q.id) || [],
      //topics: q.questionTopics,
      //options: q.options,
      userCreatedBy: q?.userCreatedBy
        ? {
            id: q.userCreatedBy.id,
            firstName: q.userCreatedBy.firstName,
            lastName: q.userCreatedBy.lastName,
            email: q.userCreatedBy.email,
          }
        : null,
    }));
  }

  async whitelistQuestion(
    questionId: number,
    isWhitelisted: boolean,
    user: any,
  ): Promise<Question> {
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
    });

    if (!question) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Question with ID ${questionId} not found.`,
      );
    }

    question.isWhitelisted = isWhitelisted;
    question.updatedBy = user.id;

    return this.questionRepo.save(question);
  }

  private shuffleArray<T>(array: T[]): T[] {
    return array
      .map((item) => ({ item, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ item }) => item);
  }

  async getQuestionsFromQIds(
    dto: GetQuestionsByIdsDto, randomOptions: boolean = true
  ): Promise<QuestionListResponseDto[]> {
    const { questionIds } = dto;
    if (!questionIds || questionIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'No question IDs provided.',
      );
    }
    // Fetch questions by ID
    const questions = await this.questionRepo.find({
      where: { id: In(questionIds) },
    });
    // Fetch related options
    let options = await this.dataSource.getRepository(QuestionOption).find({
      where: { questionId: In(questionIds) },
    });
    if (randomOptions) {
    //randomize the array order only if randomOptions is true
    options = shuffleArray(options);
    }
    // Fetch related topics via QuestionTopic
    const questionTopics = await this.dataSource
      .getRepository(QuestionTopic)
      .find({
        where: { questionId: In(questionIds) },
        relations: ['topic'],
      });
    // Map options to questions
    const optionsMap = new Map<number, any[]>();
    for (const option of options) {
      if (!optionsMap.has(option.questionId)) {
        optionsMap.set(option.questionId, []);
      }
      optionsMap.get(option.questionId).push(option);
    }
    // Map topics to questions
    const topicsMap = new Map<number, any[]>();
    for (const qt of questionTopics) {
      if (!topicsMap.has(qt.questionId)) {
        topicsMap.set(qt.questionId, []);
      }
      if (qt.topic) {
        topicsMap.get(qt.questionId).push({
          id: qt.topic.id,
          title: qt.topic.title,
          description: qt.topic.description,
          createdAt: qt.topic.createdAt,
        });
      }
    }
    // Use your existing mapper function
    return this.mappedQuestionList(questions, topicsMap, optionsMap);
  }
}
