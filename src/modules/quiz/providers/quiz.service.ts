import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { EnrollmentTierEnum, isTierAtLeast } from 'src/common/enum/enrollment-tier.enum';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { QuizStatusEnum } from 'src/common/enum/quiz-status.enum';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuestionOption } from 'src/common/typeorm/entities/question-option.entity';
import { QuizQuestion } from 'src/common/typeorm/entities/quiz-quesion.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { QuizSettings } from 'src/common/typeorm/entities/quiz-settings.entity';
import { QuizSubject } from 'src/common/typeorm/entities/quiz-subject.entity';
import { QuizTopic } from 'src/common/typeorm/entities/quiz-topic.entity';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { UserQuiz } from 'src/common/typeorm/entities/user-quiz.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import {
  generate6DigitNumber,
  generateScore,
  getTitleBySubjectIds,
  getTitleByTopicIds,
  shuffleArray,
} from 'src/common/utils/common-functions';
import { generateQuizResultFeedback } from 'src/common/utils/quiz-feedback.util';
import {
  generateSlug,
  generateUniqueSlug,
} from 'src/common/utils/slugify.util';
import { NewlyEarnedDto } from 'src/modules/achievement/dtos/newly-earned.dto';
import { AchievementService } from 'src/modules/achievement/providers/achievement.service';
import { MasterService } from 'src/modules/master/providers/master.service';
import { NotificationService } from 'src/modules/notification/providers/notification.service';
import { GetQuestionsByIdsDto } from 'src/modules/question/dtos/get-questions-by-ids.dto';
import { QuestionService } from 'src/modules/question/providers/question.service';
import { QuestionGeneratorService } from 'src/modules/question/providers/question-generator.service';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { DataSource, In, Repository } from 'typeorm';
import { CreateQuizDto } from '../dtos/create-quiz.dto';
import { PublishedQuizFilterDto } from '../dtos/published-quiz.dto';
import { AttemptDto, SubmitQuizDto } from '../dtos/submit-quiz.dto';
import { UpdateQuizDto } from '../dtos/update-quiz.dto';
import {
  DEFAULT_QUIZ_LENGTH,
  MAX_QUIZ_LENGTH,
  INITIAL_ASSESSMENT_LENGTH,
} from 'src/common/constants/quiz-generation.constants';

// UserQuiz.tag value marking the one-time onboarding skill check. Reserved: the API
// rejects it from clients (see QuizController.create).
export const INITIAL_ASSESSMENT_TAG = 'initial_assessment';

/** Parses a comma-separated id list ("1, 2,3"), dropping anything not a positive int. */
const parseIdList = (raw: string): number[] =>
  String(raw)
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => Number.isInteger(id) && id > 0);

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private quizRepository: Repository<Quiz>,
    @InjectRepository(UserQuiz)
    private userQuizRepository: Repository<UserQuiz>,
    @InjectRepository(QuizQuestion)
    private quizQuestionRepo: Repository<QuizQuestion>,
    @InjectRepository(QuizSettings)
    private quizSettingsRepository: Repository<QuizSettings>,
    @InjectRepository(QuizSubject)
    private quizSubjectRepo: Repository<QuizSubject>,
    @InjectRepository(QuizResult)
    private quizResultRepository: Repository<QuizResult>,
    private readonly questionGeneratorService: QuestionGeneratorService,
    private readonly questionService: QuestionService,
    private readonly masterService: MasterService,
    private readonly notificationService: NotificationService,
    private readonly achievementService: AchievementService,
    private readonly skillEnrollmentService: SkillEnrollmentService,
    private readonly activityService: ActivityService,
    private readonly dataSource: DataSource,
  ) { }

  /** Public route. When `viewerId` is given and they've already taken the quiz, the
   * response carries their `myResultCode` so the client can show the result instead
   * of a quiz submitQuiz would reject. */
  async fetchQuizBySlug(slug: string, viewerId?: number): Promise<any> {
    // Slugs are unique across both tables; Standard is checked first.
    let quiz: Quiz | UserQuiz = await this.quizRepository
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.quizQuestions', 'quizQuestion')
      .leftJoinAndSelect('quiz.settings', 'settings')
      .where('quiz.slug = :slug', { slug })
      .getOne();

    // Standard quizzes list questions via QuizQuestion; UserQuiz stores them inline.
    let questionIds: number[];
    if (quiz) {
      questionIds = quiz.quizQuestions.map((qq) => qq.questionId);
    } else {
      const userQuiz = await this.userQuizRepository
        .createQueryBuilder('quiz')
        .leftJoinAndSelect('quiz.settings', 'settings')
        .where('quiz.slug = :slug', { slug })
        .getOne();
      if (userQuiz) {
        (userQuiz as any).quizType = QuizTypeEnum.UserQuiz;
        quiz = userQuiz;
        questionIds = userQuiz.questionIds ?? [];
      }
    }

    if (!quiz) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Quiz not found.`);
    }

    if (!questionIds || questionIds.length === 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'No questions found for this quiz.',
      );
    }

    const isUserQuiz = (quiz as any).quizType === QuizTypeEnum.UserQuiz;
    const ids = new GetQuestionsByIdsDto();
    ids.questionIds = questionIds;
    let questions = await this.questionService.getQuestionsFromQIds(ids);

    // UserQuiz: easiest level first, random order within a level. Standard quizzes
    // keep the order returned.
    if (isUserQuiz) {
      questions = shuffleArray(questions).sort((a: any, b: any) => a.level - b.level);
    }

    let myResultCode: string | null = null;
    if (viewerId) {
      const prior = await this.quizResultRepository.findOne({
        where: isUserQuiz
          ? { userQuizId: quiz.id, userId: viewerId }
          : { quizId: quiz.id, userId: viewerId },
        // Keep `id` selected: with eager relations, findOne builds a DISTINCT subquery
        // keyed on the primary key and fails without it.
        select: { id: true, resultCode: true },
        loadEagerRelations: false,
      });
      myResultCode = prior?.resultCode ?? null;
    }

    return {
      ...quiz,
      questions,
      myResultCode,
    };
  }

  /** `skipAccessCheck` is for trusted internal callers only (the onboarding assessment)
   * — never derive it from request data. */
  async createQuiz(
    createQuizDto: CreateQuizDto,
    userId: number,
    { skipAccessCheck = false }: { skipAccessCheck?: boolean } = {},
  ): Promise<{ message: string; quiz: Quiz | UserQuiz }> {
    if (
      !createQuizDto?.subjectIds?.length &&
      !createQuizDto?.topicIds?.length &&
      !createQuizDto?.subjectTrackIds?.length
    ) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Please specify at least one subject, topic, or subjectTrack to generate a quiz.',
      );
    }

    if (
      createQuizDto?.quizType === QuizTypeEnum.Standard &&
      !createQuizDto?.questionIds?.length
    ) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'questionIds is mandatory for Standard quiz type and must be a non-empty array of numbers.',
      );
    }

    const subjectIds = createQuizDto?.subjectIds ? parseIdList(createQuizDto.subjectIds) : [];
    const subjectTrackIds = createQuizDto?.subjectTrackIds
      ? parseIdList(createQuizDto.subjectTrackIds)
      : [];
    let topicIds = createQuizDto?.topicIds ? parseIdList(createQuizDto.topicIds) : [];
    const questionIds: number[] = createQuizDto?.questionIds ?? [];

    // Guided "keep going" quiz: expand the single seed topic to it plus every later
    // topic in the subject, before anything below reads topicIds.
    if (createQuizDto?.continueThroughSubject && topicIds.length === 1) {
      topicIds = await this.questionGeneratorService.resolveForwardTopicSequence(topicIds[0]);
    }

    const isStandard = createQuizDto.quizType === QuizTypeEnum.Standard;

    // Enrollment and daily-cap gating applies to self-directed practice only — not to
    // Standard quizzes, nor to the free onboarding assessment.
    if (!isStandard && !skipAccessCheck) {
      await this.enforceSubjectAccessForUserQuiz(userId, subjectIds, topicIds, subjectTrackIds);

      // Resumption, not regeneration: every entry point (Dashboard, Badges, Skill
      // Dashboard, etc.) funnels into this one method, so a single check here covers
      // all of them. If the user already has an open (unsubmitted, same-day) UserQuiz
      // for this exact scope, hand that back instead of minting a second one.
      const existing = await this.findOpenUserQuiz(userId, subjectIds, topicIds);
      if (existing) {
        (existing as any).quizType = QuizTypeEnum.UserQuiz;
        return { message: 'Resuming your in-progress quiz.', quiz: existing };
      }
    }

    // The scopes combine (union) into one question pool.
    const ids = new GetQuestionsByIdsDto();
    ids.subjectIds = subjectIds;
    ids.topicIds = topicIds;
    ids.subjectTrackIds = subjectTrackIds;
    ids.questionIds = questionIds;
    const requestedNumQuestions =
      createQuizDto?.numQuestions ?? createQuizDto?.settings?.numQuestions;

    if (isStandard) {
      ids.numQuestions = requestedNumQuestions
        ? Math.min(requestedNumQuestions, questionIds.length)
        : questionIds.length;
    } else {
      // Hard server-side ceiling regardless of what the client asks for.
      ids.numQuestions = Math.min(requestedNumQuestions ?? DEFAULT_QUIZ_LENGTH, MAX_QUIZ_LENGTH);
    }

    let questionObj: any = null;
    let questions: any[] = [];
    let requestedCount: number | undefined;
    let actualCount: number | undefined;

    if (isStandard) {
      questions = await this.questionService.getQuestionsFromQIds(ids);
    } else {
      questionObj = await this.questionGeneratorService.generateUserQuiz(
        userId,
        ids,
      );
      questions = questionObj?.questions ?? [];
      requestedCount = questionObj?.requestedCount ?? ids.numQuestions;
      actualCount = questionObj?.actualCount ?? questions.length;
    }

    if (!questions || questions.length === 0) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        'No questions found for this quiz — the selected content may be unavailable or unpublished.',
      );
    }
    try {
      let title = createQuizDto.title;
      let shortDesc = createQuizDto.shortDesc;
      // Auto-generate a missing (or "") title/shortDesc from the scope. The first scope
      // present wins, in order Subject → SubjectTrack → Topic.
      if (!title || !shortDesc) {
        if (subjectIds && subjectIds.length > 0) {
          const subjects =
            await this.masterService.getSubjectListByIds(subjectIds);
          const names = subjects.map((s) => s.title).join(', ');
          if (!title) title = getTitleBySubjectIds(subjects) + ' Quiz';
          if (!shortDesc) shortDesc = `Test your knowledge of ${names}.`;
        }
        if (subjectTrackIds && subjectTrackIds.length > 0) {
          const tracks = await this.dataSource
            .createQueryBuilder()
            .select('st.title', 'title')
            .from('subject_track', 'st')
            .where('st.id IN (:...subjectTrackIds)', { subjectTrackIds })
            .getRawMany();
          const names = tracks.map((t) => t.title).join(', ');
          if (!title) title = tracks.map((t) => t.title).join(' ') + ' Quiz';
          if (!shortDesc) shortDesc = `A quiz covering the ${names} track.`;
        }
        if (topicIds && topicIds.length > 0) {
          const topics = await this.masterService.getTopicListByIds(topicIds);
          // Name only the first topic; a guided quiz can span dozens.
          const names = topics.length > 1
            ? `${topics[0]?.title} and ${topics.length - 1} more topics`
            : topics[0]?.title ?? '';
          if (!title) title = getTitleByTopicIds(topics) + ' Quiz';
          if (!shortDesc) shortDesc = `Quick quiz on ${names}.`;
        }
      }
      // Standard → `quiz` (curated, permanent); UserQuiz → `user_quiz` (ephemeral).
      // Both tables share the same column shape.
      const quiz: Quiz | UserQuiz = isStandard ? new Quiz() : new UserQuiz();
      quiz.title = title;
      quiz.tag = createQuizDto.tag;
      if (isStandard) (quiz as Quiz).quizType = createQuizDto.quizType;
      quiz.shortDesc = shortDesc ? shortDesc.slice(0, 200) : shortDesc;
      quiz.description = createQuizDto.description;
      quiz.goal = createQuizDto.goal ?? null;
      quiz.label = createQuizDto.label;
      quiz.category = createQuizDto.category ?? 'Default';
      if (isStandard) (quiz as Quiz).isPublished = createQuizDto.isPublished ?? false;

      let slug: string;
      if (!isStandard) {
        // UserQuiz titles repeat constantly, so the slug carries the creator's username
        // and a short timestamp, e.g. html-document-structure-quiz-by-vishal-kumar-md41k2a0
        const username = await this.getUsernameForSlug(userId);
        slug = this.buildUserQuizSlug(title, username);
        while (await this.slugExists(slug)) {
          slug = this.buildUserQuizSlug(title, username);
        }
      } else {
        slug = generateSlug(title);
        while (await this.slugExists(slug)) {
          slug = generateUniqueSlug(title);
        }
      }
      quiz.slug = slug;
      quiz.createdBy = userId;
      quiz.level = createQuizDto.level ?? DifficultyLevelEnum.Easy;
      if (!isStandard) {
        (quiz as UserQuiz).questionIds = questions.map((q) => q.id);
      }

      // Awaited (not just returned) so a failed transaction reaches the catch below.
      return await this.dataSource.transaction(async (manager) => {
        const savedQuiz = isStandard
          ? await manager.save(Quiz, quiz as Quiz)
          : await manager.save(UserQuiz, quiz as UserQuiz);
        // UserQuiz has no quizType column (the table is the type); attach it so
        // consumers can read `.quizType` uniformly.
        (savedQuiz as any).quizType = createQuizDto.quizType;
        if (!isStandard) {
          (savedQuiz as any).requestedCount = requestedCount;
          (savedQuiz as any).actualCount = actualCount;
        }

        // Link rows carry exactly one of quizId/userQuizId, plus quizType.
        const link = {
          quizId: isStandard ? savedQuiz.id : null,
          userQuizId: isStandard ? null : savedQuiz.id,
          quizType: createQuizDto.quizType,
        };

        if (isStandard) {
          await manager.save(
            QuizQuestion,
            questions.map((q) => manager.create(QuizQuestion, { ...link, questionId: q.id })),
          );
        }
        if (subjectIds.length > 0) {
          await manager.save(
            QuizSubject,
            subjectIds.map((subjectId) => manager.create(QuizSubject, { ...link, subjectId })),
          );
        }
        if (topicIds.length > 0) {
          await manager.save(
            QuizTopic,
            topicIds.map((topicId) => manager.create(QuizTopic, { ...link, topicId })),
          );
        }

        if (isStandard && createQuizDto.settings) {
          (savedQuiz as Quiz).settings = await manager.save(
            QuizSettings,
            manager.create(QuizSettings, { ...createQuizDto.settings, ...link }),
          );
        }

        return {
          message: questionObj?.message || 'Quiz created successfully.',
          quiz: savedQuiz,
        };
      });
    } catch (error) {
      // Server-side fault; log it, return a generic message.
      console.error('createQuiz: failed to save quiz', error);
      throw new AppCustomException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "We couldn't create your quiz right now. Please try again in a moment.",
      );
    }
  }

  private async getUsernameForSlug(userId: number): Promise<string> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId }, select: ['username'] });
    return user?.username || 'user';
  }

  /** `{title-slug}-by-{username}-{shortTimestamp}`, capped to the 100-char slug column. */
  private buildUserQuizSlug(title: string, username: string): string {
    const shortTimestamp =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
    const userPart = generateSlug(username, 24) || 'user';
    const suffix = `-by-${userPart}-${shortTimestamp}`;
    const titlePart = generateSlug(title, Math.max(1, 100 - suffix.length)) || 'quiz';
    return `${titlePart}${suffix}`;
  }

  /** Slugs must be unique across both `quiz` and `user_quiz` — fetchQuizBySlug looks
   * in both and can't tell a collision apart. */
  private async slugExists(slug: string, excludeQuizId?: number): Promise<boolean> {
    const [standard, userQuiz] = await Promise.all([
      this.quizRepository.findOne({ where: { slug }, select: ['id'] }),
      this.userQuizRepository.findOne({ where: { slug }, select: ['id'] }),
    ]);
    return !!userQuiz || (!!standard && standard.id !== excludeQuizId);
  }

  /** Flattens the requested scopes to the set of subjects a UserQuiz touches, for the
   * entitlement check. */
  private async resolveSubjectIdsForGating(
    subjectIds: number[],
    topicIds: number[],
    subjectTrackIds: number[],
  ): Promise<number[]> {
    const resolved = new Set<number>(subjectIds);

    if (topicIds.length) {
      const rows = await this.dataSource
        .createQueryBuilder()
        .select('t.subjectId', 'subjectId')
        .from('topic', 't')
        .where('t.id IN (:...topicIds)', { topicIds })
        .getRawMany();
      rows.forEach((r) => resolved.add(+r.subjectId));
    }

    if (subjectTrackIds.length) {
      const rows = await this.dataSource
        .createQueryBuilder()
        .select('t.subjectId', 'subjectId')
        .from('subject_track_topic', 'stt')
        .innerJoin('topic', 't', 't.id = stt.topicId')
        .where('stt.subjectTrackId IN (:...subjectTrackIds)', { subjectTrackIds })
        .getRawMany();
      rows.forEach((r) => resolved.add(+r.subjectId));
    }

    return Array.from(resolved);
  }

  /** Blocks a UserQuiz when the user isn't enrolled in every target subject, or when
   * any target subject has used up its daily question cap. The lowest effective tier
   * across the target subjects sets the cap; Pro and above are unlimited. The cap is
   * per subject and counts questions in practice quizzes generated today (not answered,
   * and not quizzes). */
  private async enforceSubjectAccessForUserQuiz(
    userId: number,
    subjectIds: number[],
    topicIds: number[],
    subjectTrackIds: number[],
  ): Promise<void> {
    const targetSubjectIds = await this.resolveSubjectIdsForGating(
      subjectIds,
      topicIds,
      subjectTrackIds,
    );
    if (!targetSubjectIds.length) return;

    const minTier = await this.skillEnrollmentService.getMinEffectiveTierForSubjects(
      userId,
      targetSubjectIds,
    );
    if (minTier === null) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        `You're not enrolled in one or more of these subjects yet. ` +
        `Enroll in the free Basic plan (or higher) to start practicing.`,
        'SUBJECT_NOT_ENROLLED',
      );
    }
    if (isTierAtLeast(minTier, EnrollmentTierEnum.Pro)) return;

    const caps = await this.skillEnrollmentService.getCapsForTier(minTier);
    const dailyCap = caps?.dailyQuestionCap;
    if (dailyCap === undefined) return;

    const usedBySubject = await this.sumQuestionsUsedTodayBySubject(userId, targetSubjectIds);
    const exhausted = targetSubjectIds.some((id) => (usedBySubject.get(id) ?? 0) >= dailyCap);
    if (exhausted) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        `You've used today's ${dailyCap} free practice questions on this subject's plan (${minTier}). ` +
        `Upgrade for unlimited practice, or come back tomorrow.`,
        'DAILY_QUOTA_EXCEEDED',
      );
    }
  }

  /** Generalizes createInitialAssessmentQuiz's tag-based idempotency to ordinary practice
   * quizzes, scoped by content instead of a fixed tag. "Open" = created today, not yet
   * submitted (no QuizResult row). Matches only subject- or topic-scoped requests — those
   * are the only two shapes with a persisted QuizSubject/QuizTopic link row to exact-match
   * against; a pure subjectTrack-only request has no such signal, so it always generates
   * fresh rather than risk resuming the wrong scope. */
  private async findOpenUserQuiz(
    userId: number,
    subjectIds: number[],
    topicIds: number[],
  ): Promise<UserQuiz | null> {
    if (!topicIds.length && !subjectIds.length) return null;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const candidates = await this.userQuizRepository
      .createQueryBuilder('q')
      .leftJoin(QuizResult, 'qr', 'qr.userQuizId = q.id')
      .where('q.createdBy = :userId', { userId })
      .andWhere('q.createdAt >= :startOfDay', { startOfDay })
      .andWhere('qr.id IS NULL')
      .orderBy('q.createdAt', 'DESC')
      .getMany();
    if (!candidates.length) return null;

    const candidateIds = candidates.map((c) => c.id);
    const [subjectLinks, topicLinks] = await Promise.all([
      this.quizSubjectRepo.find({ where: { userQuizId: In(candidateIds) } }),
      this.dataSource.getRepository(QuizTopic).find({ where: { userQuizId: In(candidateIds) } }),
    ]);

    const sameSet = (linked: number[], requested: number[]): boolean =>
      linked.length === requested.length && requested.every((id) => linked.includes(id));

    return (
      candidates.find((c) => {
        const linkedSubjects = subjectLinks.filter((l) => l.userQuizId === c.id).map((l) => l.subjectId);
        const linkedTopics = topicLinks.filter((l) => l.userQuizId === c.id).map((l) => l.topicId);
        return sameSet(linkedSubjects, subjectIds) && sameSet(linkedTopics, topicIds);
      }) ?? null
    );
  }

  /** Questions in the user's practice quizzes generated today, per subject. Counted from
   * UserQuiz.questionIds; UserQuiz has no QuizSettings row to read a count from. */
  private async sumQuestionsUsedTodayBySubject(
    userId: number,
    subjectIds: number[],
  ): Promise<Map<number, number>> {
    if (!subjectIds.length) return new Map();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const rows = await this.quizSubjectRepo
      .createQueryBuilder('qs')
      .innerJoin(UserQuiz, 'q', 'q.id = qs.userQuizId')
      .select('qs.subjectId', 'subjectId')
      .addSelect('SUM(JSON_LENGTH(q.questionIds))', 'total')
      .where('q.createdBy = :userId', { userId })
      .andWhere('q.createdAt >= :startOfDay', { startOfDay })
      .andWhere('qs.subjectId IN (:...subjectIds)', { subjectIds })
      .groupBy('qs.subjectId')
      .getRawMany<{ subjectId: number; total: string }>();

    return new Map(rows.map((r) => [Number(r.subjectId), Number(r.total) || 0]));
  }

  /** Display-only counterpart to enforceSubjectAccessForUserQuiz ("X of Y practice
   * questions left today"). `tier: null` = not enrolled; `dailyQuestionCap: null` =
   * unlimited. */
  async getSubjectQuestionQuota(
    userId: number,
    subjectId: number,
  ): Promise<{ tier: EnrollmentTierEnum | null; dailyQuestionCap: number | null; questionsUsedToday: number }> {
    const tier = await this.skillEnrollmentService.getMinEffectiveTierForSubjects(userId, [subjectId]);
    if (tier === null) {
      return { tier: null, dailyQuestionCap: null, questionsUsedToday: 0 };
    }
    if (isTierAtLeast(tier, EnrollmentTierEnum.Pro)) {
      return { tier, dailyQuestionCap: null, questionsUsedToday: 0 };
    }

    const caps = await this.skillEnrollmentService.getCapsForTier(tier);
    const dailyCap = caps?.dailyQuestionCap ?? null;
    if (dailyCap === null) {
      return { tier, dailyQuestionCap: null, questionsUsedToday: 0 };
    }

    const usedBySubject = await this.sumQuestionsUsedTodayBySubject(userId, [subjectId]);
    return { tier, dailyQuestionCap: dailyCap, questionsUsedToday: usedBySubject.get(subjectId) ?? 0 };
  }

  /** One-time skill check for a new user across every subject in their job role.
   * Idempotent: returns the existing one if already generated. Gets its own
   * QuizSettings row, since createQuiz only creates settings for Standard quizzes. */
  async createInitialAssessmentQuiz(
    userId: number,
    firstName: string,
    jobRoleId: number,
  ): Promise<{ message: string; quiz: UserQuiz }> {
    const existing = await this.userQuizRepository.findOne({
      where: { createdBy: userId, tag: INITIAL_ASSESSMENT_TAG },
      relations: ['settings'],
    });
    if (existing) {
      return { message: 'Initial assessment already generated.', quiz: existing };
    }

    const subjectRows = await this.dataSource
      .createQueryBuilder()
      .select('jrs.subjectId', 'subjectId')
      .from('job_role_subject', 'jrs')
      .where('jrs.jobRoleId = :jobRoleId', { jobRoleId })
      .getRawMany();
    const subjectIds = subjectRows.map((r) => +r.subjectId);
    if (!subjectIds.length) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'This job role has no subjects configured yet — cannot generate an initial assessment.',
      );
    }

    const jobRoleRow = await this.dataSource
      .createQueryBuilder()
      .select('jr.title', 'title')
      .from('job_role', 'jr')
      .where('jr.id = :jobRoleId', { jobRoleId })
      .getRawOne();
    const jobRoleTitle = jobRoleRow?.title ?? 'Career Track';

    const createQuizDto: CreateQuizDto = {
      userId,
      quizType: QuizTypeEnum.UserQuiz,
      subjectIds: subjectIds.join(','),
      numQuestions: INITIAL_ASSESSMENT_LENGTH,
      title: `Initial Assessment - ${jobRoleTitle} - ${firstName}`,
      tag: INITIAL_ASSESSMENT_TAG,
      category: 'InitialAssessment',
    } as CreateQuizDto;

    const created = await this.createQuiz(createQuizDto, userId, { skipAccessCheck: true });
    const quiz = created.quiz as UserQuiz;

    // May be fewer than requested when the subjects have few questions.
    const actualQuestionCount = quiz.questionIds?.length ?? 0;

    const quizSettings = this.quizSettingsRepository.create({
      userQuizId: quiz.id,
      quizType: QuizTypeEnum.UserQuiz,
      numQuestions: actualQuestionCount,
      maxAttempts: 1,
    });
    quiz.settings = await this.quizSettingsRepository.save(quizSettings);

    return { message: 'Initial assessment generated successfully.', quiz };
  }

  /** Re-derives isCorrect from QuestionOption rather than trusting the client.
   * Question selection permanently excludes questions answered correctly, so a
   * mis-scored attempt would skew it for good. Questions without options (free text)
   * keep the client-reported value — there's nothing to check against. */
  private async recomputeAttemptCorrectness(
    rawAttempts: AttemptDto[],
  ): Promise<AttemptDto[]> {
    if (rawAttempts.length === 0) return rawAttempts;

    const questionIds = [...new Set(rawAttempts.map((a) => a.questionId))];
    const options = await this.dataSource.getRepository(QuestionOption).find({
      where: { questionId: In(questionIds) },
      select: ['id', 'questionId', 'correct'],
    });

    const correctIdsByQuestion = new Map<number, Set<number>>();
    const questionsWithOptions = new Set<number>();
    for (const opt of options) {
      questionsWithOptions.add(opt.questionId);
      if (opt.correct) {
        if (!correctIdsByQuestion.has(opt.questionId)) {
          correctIdsByQuestion.set(opt.questionId, new Set());
        }
        correctIdsByQuestion.get(opt.questionId).add(opt.id);
      }
    }

    return rawAttempts.map((a) => {
      if (!questionsWithOptions.has(a.questionId)) {
        // No options at all -> free-text/ungradable question. Unchanged.
        return a;
      }
      const correctIds = correctIdsByQuestion.get(a.questionId);
      if (!correctIds || correctIds.size === 0) {
        // Bad data: options exist but none is marked correct. Don't fall back to the client.
        console.warn(
          `recomputeAttemptCorrectness: question ${a.questionId} has no correct option; grading as incorrect.`,
        );
        return { ...a, isCorrect: false };
      }
      return {
        ...a,
        isCorrect: !a.isSkipped && correctIds.has(a.selectedOption),
      };
    });
  }

  /** Loads the quiz being submitted. `quiz` and `user_quiz` have independent id
   * sequences, so quizType is required — never guess the table from a bare id. */
  private async resolveQuizAnchor(
    quizId: number,
    quizType?: QuizTypeEnum,
  ): Promise<{ quizType: QuizTypeEnum; title: string; questionIds: Set<number> }> {
    if (!quizType) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'quizType is required to submit a quiz (quizId alone is ambiguous between Standard and UserQuiz).',
      );
    }
    if (quizType === QuizTypeEnum.Standard) {
      const standard = await this.quizRepository.findOne({ where: { id: quizId }, select: ['id', 'title'] });
      if (!standard) throw new AppCustomException(HttpStatus.NOT_FOUND, `Quiz with ID ${quizId} not found.`);
      const rows = await this.quizQuestionRepo.find({ where: { quizId }, select: ['questionId'] });
      return {
        quizType: QuizTypeEnum.Standard,
        title: standard.title,
        questionIds: new Set(rows.map((r) => r.questionId)),
      };
    }
    const userQuiz = await this.userQuizRepository.findOne({
      where: { id: quizId },
      select: ['id', 'title', 'questionIds'],
    });
    if (!userQuiz) throw new AppCustomException(HttpStatus.NOT_FOUND, `Quiz with ID ${quizId} not found.`);
    return {
      quizType: QuizTypeEnum.UserQuiz,
      title: userQuiz.title,
      questionIds: new Set(userQuiz.questionIds ?? []),
    };
  }

  private quizAlreadyTakenException(): AppCustomException {
    return new AppCustomException(
      HttpStatus.CONFLICT,
      "You've already taken this quiz. Each quiz can be attempted once.",
      'QUIZ_ALREADY_TAKEN',
    );
  }

  /** Keeps only attempts for this quiz's questions, one per question (first wins), so a
   * client can't pad a submission to inflate score, XP or badge progress. */
  private filterAttemptsToQuiz(attempts: AttemptDto[], quizQuestionIds: Set<number>): AttemptDto[] {
    const seen = new Set<number>();
    return attempts.filter((a) => {
      if (!quizQuestionIds.has(a.questionId) || seen.has(a.questionId)) return false;
      seen.add(a.questionId);
      return true;
    });
  }

  async submitQuiz(
    submitQuizDto: SubmitQuizDto,
  ): Promise<QuizResult & { newlyEarned?: NewlyEarnedDto | null }> {
    const { quizType, title: quizTitle, questionIds: quizQuestionIds } = await this.resolveQuizAnchor(
      submitQuizDto?.quizId,
      submitQuizDto?.quizType,
    );
    const isStandard = quizType === QuizTypeEnum.Standard;
    const anchor = isStandard
      ? { quizId: submitQuizDto.quizId, userQuizId: null as number | null }
      : { quizId: null as number | null, userQuizId: submitQuizDto.quizId };
    const anchorWhere = isStandard
      ? { quizId: submitQuizDto.quizId }
      : { userQuizId: submitQuizDto.quizId };

    const settings = await this.quizSettingsRepository.findOne({
      where: anchorWhere,
      select: ['passMarks'],
    });

    // One attempt per person per quiz (supersedes QuizSettings.maxAttempts). The unique
    // indexes on quiz_result back this up against double-submit races — see the catch.
    const alreadyTaken = await this.quizResultRepository.exists({
      where: { ...anchorWhere, userId: submitQuizDto.userId },
    });
    if (alreadyTaken) throw this.quizAlreadyTakenException();

    // Totals and score are recomputed server-side, never taken from the client, using
    // the same generateScore() as every other scoring surface.
    const rawAttempts = this.filterAttemptsToQuiz(submitQuizDto?.attempts ?? [], quizQuestionIds);
    if (rawAttempts.length === 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'None of the submitted answers belong to this quiz.',
      );
    }
    const attempts = await this.recomputeAttemptCorrectness(rawAttempts);
    const total = attempts.length;
    const correct = attempts.filter((a) => a?.isCorrect === true).length;
    const unanswered = attempts.filter((a) => a?.isSkipped === true).length;
    const wrong = attempts.filter((a) => a?.isSkipped !== true && a?.isCorrect !== true).length;
    const score = generateScore(total, correct, wrong);

    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: submitQuizDto?.userId }, select: ['firstName'] });
    const feedback = generateQuizResultFeedback({
      firstName: user?.firstName,
      score,
      total,
      unanswered,
      passMarks: settings?.passMarks ?? 60,
    });

    let questionResult: QuizResult;
    // Saved attempt ids let the achievement layer tell this submission's correct answers
    // apart from ones already on record (see EvaluateAfterQuizAttempt.id).
    let savedAttempts: { id: number; questionId: number; isCorrect: boolean; isSkipped: boolean; hintUsed: boolean }[] = [];
    try {
      questionResult = await this.dataSource.transaction(async (manager) => {
        const result = manager.create(QuizResult, {
          ...anchor,
          quizType,
          userId: submitQuizDto?.userId,
          resultCode: generate6DigitNumber(),
          total,
          correct,
          wrong,
          unanswered,
          timeSpent: submitQuizDto?.timeSpent,
          score,
          feedback,
          status: QuizStatusEnum.Completed,
          // Clamped to column widths so oversized telemetry can't fail the submission.
          device: submitQuizDto?.device?.slice(0, 100),
          client: submitQuizDto?.client?.slice(0, 100),
          ipAddress: submitQuizDto?.ipAddress?.slice(0, 45),
        });

        const savedResult = await manager.save(QuizResult, result);

        const questionAttempts = attempts.map((attempt) =>
          manager.create(QuestionAttempt, {
            ...anchor,
            quizType,
            resultId: savedResult.id,
            userId: submitQuizDto?.userId,
            questionId: attempt.questionId,
            selectedOption: attempt?.selectedOption,
            timeTaken: attempt?.timeTaken,
            isSkipped: attempt?.isSkipped,
            hintUsed: attempt?.hintUsed,
            isCorrect: attempt?.isCorrect,
            // Display-only copy of the chosen option's text.
            answer: attempt?.answer?.slice(0, 255),
          }),
        );
        const saved = await manager.save(QuestionAttempt, questionAttempts);
        savedAttempts = saved.map((s) => ({
          id: s.id,
          questionId: s.questionId,
          isCorrect: s.isCorrect,
          isSkipped: s.isSkipped,
          hintUsed: s.hintUsed,
        }));

        return savedResult;
      });
    } catch (error) {
      // Lost a race with a concurrent submit of the same quiz.
      if (
        error?.code === 'ER_DUP_ENTRY' &&
        /UQ_quiz_result_(quizId|userQuizId)_userId/.test(String(error?.message))
      ) {
        throw this.quizAlreadyTakenException();
      }
      console.error('submitQuiz: failed to save result', error);
      throw new AppCustomException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to submit quiz result.',
      );
    }

    // Side effects below run after commit and must never fail the submission: the
    // result and attempts above are the source of truth.
    try {
      await this.notificationService.notifyQuizCompleted(
        submitQuizDto?.userId,
        quizTitle ?? 'Quiz',
        score,
        submitQuizDto?.quizId,
      );
    } catch (error) {
      console.error('submitQuiz: failed to create notification', error);
    }

    try {
      await this.activityService.createActivity(
        submitQuizDto?.userId,
        'Quiz Completed',
        `completed "${quizTitle ?? 'a quiz'}" — scored ${score}% (${correct}/${total} correct).`,
        { dataId: String(questionResult.id), dataType: 'quiz_result' },
      );
    } catch (error) {
      console.error('submitQuiz: failed to log activity', error);
    }

    // XP, streak, badges, certificates.
    let newlyEarned: NewlyEarnedDto | null = null;
    try {
      newlyEarned = await this.achievementService.evaluateAfterQuiz({
        userId: submitQuizDto?.userId,
        score,
        attempts: savedAttempts,
      });
    } catch (error) {
      console.error('submitQuiz: achievement evaluation failed', error);
    }

    return { ...questionResult, newlyEarned };
  }

  /** Standard quizzes authored by `userId` (all authors' for an admin). */
  async getUserQuizzes(userId: number, isAdmin: boolean): Promise<any> {
    const query = this.quizRepository
      .createQueryBuilder('quiz')
      .leftJoin(QuizResult, 'qr', 'qr.quizId = quiz.id')
      .leftJoin(QuizQuestion, 'qq', 'qq.quizId = quiz.id')
      .leftJoin(User, 'user', 'user.id = quiz.createdBy')

      .select('quiz.id', 'id')
      .addSelect('quiz.title', 'title')
      .addSelect('quiz.slug', 'slug')
      .addSelect('quiz.quizType', 'quizType')
      .addSelect('quiz.isPublished', 'isPublished')
      .addSelect('quiz.label', 'label')
      .addSelect('quiz.description', 'description')
      .addSelect('quiz.createdAt', 'createdAt')
      .addSelect('user.firstName', 'createdBy')
      .addSelect('COUNT(DISTINCT qr.id)', 'totalAttempts')
      .addSelect('COUNT(DISTINCT qq.id)', 'totalQuestions')
      .andWhere('quiz.quizType = :quizType', {
        quizType: QuizTypeEnum.Standard,
      })

    if (!isAdmin) {
      query.andWhere(
        'quiz.createdBy = :userId',
        { userId },
      );
    }
    const quizzes = await query
      .groupBy('quiz.id')
      .addGroupBy('quiz.title')
      .addGroupBy('quiz.slug')
      .addGroupBy('quiz.quizType')
      .addGroupBy('quiz.isPublished')
      .addGroupBy('quiz.label')
      .addGroupBy('quiz.description')
      .addGroupBy('quiz.createdAt')
      .addGroupBy('user.firstName')
      .orderBy('quiz.createdAt', 'DESC')
      .getRawMany();

    return quizzes.map((item) => ({
      id: parseInt(item.id, 10),
      title: item.title,
      slug: item.slug,
      quizType: item.quizType,
      isPublished: Boolean(item.isPublished),
      status: Boolean(item.isPublished) ? 'Published' : 'Draft',
      label: item.label,
      description: item.description,
      createdAt: item.createdAt,
      author: item.createdBy,
      totalQuestions: parseInt(item.totalQuestions, 10) || 0,
      totalAttempts: parseInt(item.totalAttempts, 10) || 0,
    }));
  }

  /** "My Quizzes": the practice quizzes this user generated, with counts and their own
   * result if they've taken it. totalAttempts includes other people the quiz was
   * shared with. */
  async getMyPracticeQuizzes(userId: number): Promise<any[]> {
    const quizzes = await this.userQuizRepository
      .createQueryBuilder('uq')
      .leftJoin(QuizResult, 'qr', 'qr.userQuizId = uq.id')
      .select('uq.id', 'id')
      .addSelect('uq.title', 'title')
      .addSelect('uq.slug', 'slug')
      .addSelect('uq.tag', 'tag')
      .addSelect('uq.category', 'category')
      .addSelect('uq.level', 'level')
      .addSelect('uq.createdAt', 'createdAt')
      .addSelect('COUNT(DISTINCT qr.id)', 'totalAttempts')
      .addSelect('COALESCE(JSON_LENGTH(uq.questionIds), 0)', 'totalQuestions')
      .addSelect(
        `(SELECT qr2.resultCode FROM quiz_result qr2
          WHERE qr2.userQuizId = uq.id AND qr2.userId = uq.createdBy
          ORDER BY qr2.createdAt DESC LIMIT 1)`,
        'latestResultCode',
      )
      .where('uq.createdBy = :userId', { userId })
      .groupBy('uq.id')
      .addGroupBy('uq.title')
      .addGroupBy('uq.slug')
      .addGroupBy('uq.tag')
      .addGroupBy('uq.category')
      .addGroupBy('uq.level')
      .addGroupBy('uq.createdAt')
      .orderBy('uq.createdAt', 'DESC')
      .getRawMany();

    return quizzes.map((item) => ({
      id: parseInt(item.id, 10),
      title: item.title,
      slug: item.slug,
      tag: item.tag,
      category: item.category,
      level: item.level,
      createdAt: item.createdAt,
      totalQuestions: parseInt(item.totalQuestions, 10) || 0,
      totalAttempts: parseInt(item.totalAttempts, 10) || 0,
      isQuizTaken: !!item.latestResultCode,
      latestResultCode: item.latestResultCode ?? null,
    }));
  }

  /** Published Standard quizzes, optionally filtered (a filter of 0 is ignored). */
  async getPublishedQuizzes(filters: PublishedQuizFilterDto): Promise<any[]> {
    const query = this.quizRepository
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.settings', 'settings')
      .leftJoinAndSelect('quiz.userCreatedBy', 'userCreatedBy')
      .leftJoin(QuizSubject, 'quizSubjects', 'quizSubjects.quizId = quiz.id')
      .leftJoinAndMapMany('quiz.subjects', Subject, 'subject', 'subject.id = quizSubjects.subjectId')
      .where('quiz.isPublished = :isPublished', { isPublished: true })
      .andWhere('quiz.quizType = :quizType', { quizType: QuizTypeEnum.Standard });

    // EXISTS subqueries rather than joins, so filters don't multiply rows or narrow
    // the mapped `subjects` list.
    if (Number(filters.jobRoleId)) {
      query.andWhere(
        `EXISTS (SELECT 1 FROM quiz_subject fqs
          INNER JOIN job_role_subject jrs ON jrs.subjectId = fqs.subjectId
          WHERE fqs.quizId = quiz.id AND jrs.jobRoleId = :jobRoleId)`,
        { jobRoleId: Number(filters.jobRoleId) },
      );
    }
    if (Number(filters.subjectId)) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM quiz_subject fqs WHERE fqs.quizId = quiz.id AND fqs.subjectId = :subjectId)',
        { subjectId: Number(filters.subjectId) },
      );
    }
    if (Number(filters.topicId)) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM quiz_topic fqt WHERE fqt.quizId = quiz.id AND fqt.topicId = :topicId)',
        { topicId: Number(filters.topicId) },
      );
    }
    if (filters.mode) {
      query.andWhere('settings.mode = :mode', { mode: filters.mode });
    }

    const quizzes = await query.orderBy('quiz.createdAt', 'DESC').getMany();
    if (!quizzes.length) return [];

    const quizIds = quizzes.map((quiz) => quiz.id);
    const [attempts, questionCounts] = await Promise.all([
      this.quizResultRepository
        .createQueryBuilder('qr')
        .select('qr.quizId', 'quizId')
        .addSelect('COUNT(qr.id)', 'total')
        .where('qr.quizId IN (:...quizIds)', { quizIds })
        .groupBy('qr.quizId')
        .getRawMany(),
      this.quizQuestionRepo
        .createQueryBuilder('qq')
        .select('qq.quizId', 'quizId')
        .addSelect('COUNT(qq.id)', 'total')
        .where('qq.quizId IN (:...quizIds)', { quizIds })
        .groupBy('qq.quizId')
        .getRawMany(),
    ]);
    const attemptMap = new Map(attempts.map((r) => [Number(r.quizId), Number(r.total)]));
    const questionCountMap = new Map(questionCounts.map((r) => [Number(r.quizId), Number(r.total)]));

    return quizzes.map((quiz: any) => {
      const { userCreatedBy, ...quizData } = quiz;
      const createdByName =
        `${userCreatedBy?.firstName || ''} ${userCreatedBy?.lastName || ''}`.trim();

      return {
        ...quizData,
        createdBy: userCreatedBy
          ? { id: userCreatedBy.id, name: createdByName || userCreatedBy.username || null }
          : null,
        status: quiz.isPublished ? 'Published' : 'Draft',
        totalQuestions: questionCountMap.get(quiz.id) || 0,
        totalAttempts: attemptMap.get(quiz.id) || 0,
        settings: quiz.settings || null,
        subjects:
          quiz.subjects?.map((subject: any) => ({
            id: subject.id,
            title: subject.title,
            colour: subject.color,
            image: subject.image,
          })) || [],
      };
    });
  }

  async updateQuiz(
    quizId: number,
    updateQuizDto: UpdateQuizDto,
    userId: number,
  ): Promise<Quiz> {
    // createdBy is select:false on the entity.
    const quiz = await this.quizRepository
      .createQueryBuilder('quiz')
      .addSelect('quiz.createdBy')
      .where('quiz.id = :id', { id: quizId })
      .getOne();

    if (!quiz) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Quiz with ID ${quizId} not found.`,
      );
    }

    if (quiz.createdBy !== userId) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You are not authorized to update this quiz.',
      );
    }

    if (quiz.quizType !== QuizTypeEnum.Standard) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Only Standard quizzes can be updated.',
      );
    }

    const subjectIds = updateQuizDto?.subjectIds ? parseIdList(updateQuizDto.subjectIds) : [];
    const topicIds = updateQuizDto?.topicIds ? parseIdList(updateQuizDto.topicIds) : [];
    const questionIds: number[] = updateQuizDto?.questionIds ?? [];

    if (updateQuizDto.title) {
      quiz.title = updateQuizDto.title;
      let slug = generateSlug(updateQuizDto.title);
      while (await this.slugExists(slug, quizId)) {
        slug = generateUniqueSlug(updateQuizDto.title);
      }
      quiz.slug = slug;
    }

    if (updateQuizDto.shortDesc !== undefined) quiz.shortDesc = updateQuizDto.shortDesc;
    if (updateQuizDto.description !== undefined) quiz.description = updateQuizDto.description;
    if (updateQuizDto.label !== undefined) quiz.label = updateQuizDto.label;
    if (updateQuizDto.isPublished !== undefined) quiz.isPublished = updateQuizDto.isPublished;
    if (updateQuizDto.goal !== undefined) quiz.goal = updateQuizDto.goal;
    if (updateQuizDto.category !== undefined) quiz.category = updateQuizDto.category;
    if (updateQuizDto.level !== undefined) quiz.level = updateQuizDto.level;

    return this.dataSource.transaction(async (manager) => {
      const updatedQuiz = await manager.save(Quiz, quiz);
      const link = { quizId: updatedQuiz.id, quizType: QuizTypeEnum.Standard };

      // Link lists are replaced wholesale when provided; an explicitly sent empty
      // subjectIds/topicIds clears them.
      if (questionIds.length > 0) {
        await manager.delete(QuizQuestion, { quizId: updatedQuiz.id });
        await manager.save(
          QuizQuestion,
          questionIds.map((questionId) => manager.create(QuizQuestion, { ...link, questionId })),
        );
      }
      if (updateQuizDto.subjectIds !== undefined) {
        await manager.delete(QuizSubject, { quizId: updatedQuiz.id });
        if (subjectIds.length > 0) {
          await manager.save(
            QuizSubject,
            subjectIds.map((subjectId) => manager.create(QuizSubject, { ...link, subjectId })),
          );
        }
      }
      if (updateQuizDto.topicIds !== undefined) {
        await manager.delete(QuizTopic, { quizId: updatedQuiz.id });
        if (topicIds.length > 0) {
          await manager.save(
            QuizTopic,
            topicIds.map((topicId) => manager.create(QuizTopic, { ...link, topicId })),
          );
        }
      }

      if (updateQuizDto.settings) {
        const existingSettings = await manager.findOne(QuizSettings, {
          where: { quizId: updatedQuiz.id },
        });
        await manager.save(
          QuizSettings,
          existingSettings
            ? Object.assign(existingSettings, updateQuizDto.settings)
            : manager.create(QuizSettings, { ...updateQuizDto.settings, ...link }),
        );
      }

      return updatedQuiz;
    });
  }
}
