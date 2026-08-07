import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { QuizQuestion } from 'src/common/typeorm/entities/quiz-quesion.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { QuizSubject } from 'src/common/typeorm/entities/quiz-subject.entity';
import { QuizTopic } from 'src/common/typeorm/entities/quiz-topic.entity';
import { Quiz } from 'src/common/typeorm/entities/quiz.entity';
import { QuizSettings } from 'src/common/typeorm/entities/quiz-settings.entity';
import { QuizTypeEnum } from 'src/common/enum/quiz-type.enum';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import {
  generate6DigitNumber,
  generateScore,
  getTitleBySubjectIds,
  getTitleByTopicIds,
  shuffleArray,
} from 'src/common/utils/common-functions';
import {
  generateSlug,
  generateUniqueSlug,
} from 'src/common/utils/slugify.util';
import { MasterService } from 'src/modules/master/providers/master.service';
import { NotificationService } from 'src/modules/notification/providers/notification.service';
import { GetQuestionsByIdsDto } from 'src/modules/question/dtos/get-questions-by-ids.dto';
import { QuestionService } from 'src/modules/question/providers/question.service';
import { QuestionGeneratorService } from 'src/modules/question/providers/question-generator.service';
import { DataSource, In, Repository } from 'typeorm';
import { CreateQuizDto } from '../dtos/create-quiz.dto';
import { UpdateQuizDto } from '../dtos/update-quiz.dto';
import { SubmitQuizDto } from '../dtos/submit-quiz.dto';
import { Question } from 'src/common/typeorm/entities/question.entity';
import { PublishedQuizFilterDto } from '../dtos/published-quiz.dto';
import { User } from 'src/common/typeorm/entities/user.entity';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { MailService } from 'src/common/mail/providers/mail.service';
import { AchievementService } from 'src/modules/achievement/providers/achievement.service';
import { NewlyEarnedDto } from 'src/modules/achievement/dtos/newly-earned.dto';
import {
  DEFAULT_QUIZ_LENGTH,
  MAX_QUIZ_LENGTH,
  INITIAL_ASSESSMENT_LENGTH,
} from 'src/common/constants/quiz-generation.constants';

// Marks a Quiz (Quiz.tag) as the one-time, system-generated initial skill check,
// distinguishing it from every other UserQuiz a user creates for themselves.
const INITIAL_ASSESSMENT_TAG = 'initial_assessment';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private quizRepository: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private quizQuestionRepo: Repository<QuizQuestion>,
    @InjectRepository(QuizSettings)
    private quizSettingsRepository: Repository<QuizSettings>,
    @InjectRepository(QuizSubject)
    private quizSubjectRepo: Repository<QuizSubject>,
    @InjectRepository(QuizTopic)
    private quizTopicRepo: Repository<QuizTopic>,
    @InjectRepository(QuizResult)
    private quizResultRepository: Repository<QuizResult>,
    private readonly questionGeneratorService: QuestionGeneratorService,
    private readonly questionService: QuestionService,
    private readonly masterService: MasterService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
    private readonly achievementService: AchievementService,
    private readonly dataSource: DataSource,
  ) {}

  async fetchQuizBySlug(slug: string): Promise<any> {
  const quiz = await this.quizRepository
  .createQueryBuilder('quiz')
  .leftJoinAndSelect('quiz.quizQuestions', 'quizQuestion')
  .leftJoinAndSelect('quiz.settings', 'settings')
  .where('quiz.slug = :slug', { slug })
  .getOne();

    if (!quiz) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, `Quiz not found.`);
    }

    if (!quiz.quizQuestions || quiz.quizQuestions.length === 0) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'No questions found for this quiz.',
      );
    }

    // Step 1: Collect questionIds
    const questionIds = quiz.quizQuestions.map((qq) => qq.questionId);

    // Step 2: Use QuestionService
    const ids = new GetQuestionsByIdsDto();
    ids.questionIds = questionIds;
    let questions = await this.questionService.getQuestionsFromQIds(ids);

    // getQuestionsFromQIds() doesn't preserve any particular order — for a UserQuiz,
    // shuffle then stable-sort by level so the user always sees Easy questions first,
    // then Intermediate, then Advanced (random order within a level). Derived purely
    // from each question's own level at read time, so this works retroactively for
    // quizzes generated before this ordering existed. Standard quizzes are untouched.
    if (quiz.quizType === QuizTypeEnum.UserQuiz) {
      questions = shuffleArray(questions).sort((a: any, b: any) => a.level - b.level);
    }

    // Step 3: Return quiz with questions
    return {
      ...quiz,
      questions,
    };
  }

  async createQuiz(
    createQuizDto: CreateQuizDto,
    userId: number,
  ): Promise<Quiz> {
    console.log('quiz service called');
    console.log('QuizBuilder @createQuiz called:', createQuizDto);
    let quizCategory = '';
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

    console.log('QuizBuilder @createQuiz Start:', createQuizDto?.subjectIds);
    let topicIds: number[] = [];
    let subjectIds: number[] = [];
    let subjectTrackIds: number[] = [];
    const questionIds: number[] = createQuizDto?.questionIds ?? [];

    const parseIdList = (raw: string): number[] =>
      String(raw)
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (createQuizDto?.subjectIds) {
      subjectIds = parseIdList(createQuizDto.subjectIds);
    }
    if (subjectIds.length > 0) {
      quizCategory = 'Subject';
    }

    if (createQuizDto?.subjectTrackIds) {
      subjectTrackIds = parseIdList(createQuizDto.subjectTrackIds);
    }
    if (subjectTrackIds.length > 0) {
      quizCategory = 'SubjectTrack';
    }

    if (createQuizDto?.topicIds) {
      topicIds = parseIdList(createQuizDto.topicIds);
    }
    if (topicIds.length > 0) {
      quizCategory = 'Topic';
    }

    // All three scopes are resolved down to one topic-level pool by
    // QuestionGeneratorService — they combine (union), they don't override each other,
    // so a quiz can legitimately span e.g. one whole subject plus a couple of
    // specific extra topics. `quizCategory` above only picks a label for the
    // auto-generated title when multiple scopes are given at once, most-specific wins.
    const ids = new GetQuestionsByIdsDto();
    ids.subjectIds = subjectIds;
    ids.topicIds = topicIds;
    ids.subjectTrackIds = subjectTrackIds;
    ids.questionIds = questionIds;
    const requestedNumQuestions =
      createQuizDto?.numQuestions ?? createQuizDto?.settings?.numQuestions;

    if (createQuizDto?.quizType === QuizTypeEnum.Standard) {
      ids.numQuestions = requestedNumQuestions
        ? Math.min(requestedNumQuestions, questionIds.length)
        : questionIds.length;
    } else if (createQuizDto?.quizType === QuizTypeEnum.UserQuiz) {
      // Server-side cap — no client request can produce a quiz longer than
      // MAX_QUIZ_LENGTH, regardless of what numQuestions asks for. This is what
      // stops a "practice this topic" request from silently returning every
      // question in the topic.
      ids.numQuestions = Math.min(requestedNumQuestions ?? DEFAULT_QUIZ_LENGTH, MAX_QUIZ_LENGTH);
    } else if (requestedNumQuestions && requestedNumQuestions > 0) {
      ids.numQuestions = requestedNumQuestions;
    } else {
      ids.numQuestions = 20;
    }

    console.log('QuizBuilder @Input:', ids);
    let questionObj: any = null;
    let questions: any[] = [];

    if (createQuizDto?.quizType === QuizTypeEnum.Standard) {
      questions = await this.questionService.getQuestionsFromQIds(ids);
    } else {
      questionObj = await this.questionGeneratorService.generateUserQuiz(
        userId,
        ids,
      );
      questions = questionObj?.questions ?? [];
    }

    // Save quiz in DB if at least 3 questions are available
    if (!questions || questions.length === 0) {
      const questionCount = questions?.length ?? 0;
      console.log('QuizBuilder #4: @NotEnoughQuestions', questionCount);
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Not enough questions ${questionCount} found for the given ${quizCategory}`,
      );
    }
    try {
      let title = createQuizDto.title;
      let shortDesc = createQuizDto.shortDesc;
      // Frontend sends "" rather than omitting these fields — both are falsy, so this
      // still triggers auto-generation. Reuses the one lookup per scope for both title
      // and shortDesc instead of querying twice; precedence (last-applied-wins, most
      // specific scope given overwrites) matches quizCategory's Subject → SubjectTrack →
      // Topic order above.
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
          const names = topics.map((t) => t.title).join(', ');
          if (!title) title = getTitleByTopicIds(topics) + ' Quiz';
          if (!shortDesc) shortDesc = `Quick quiz on ${names}.`;
        }
      }
      const quiz = new Quiz();
      quiz.title = title;
      quiz.tag = createQuizDto.tag ;
      quiz.quizType = createQuizDto.quizType;
      quiz.shortDesc = shortDesc ? shortDesc.slice(0, 200) : shortDesc;
      quiz.description = createQuizDto.description;
      quiz.goal = createQuizDto.goal ?? null;
      quiz.label = createQuizDto.label;
      quiz.category = createQuizDto.category ?? 'Default';
      quiz.isPublished = createQuizDto.isPublished ?? false;

      let slug: string;
      if (createQuizDto.quizType === QuizTypeEnum.UserQuiz) {
        // Auto-generated UserQuiz titles are templated from scope names (e.g. every
        // "HTML Document Structure" topic quiz gets the same title), so the plain
        // title-slug collides constantly — baking in the creator's username + a short
        // timestamp makes every UserQuiz slug unique on the first try, and still reads
        // as: html-document-structure-quiz-by-vishal-kumar-md41k2a0
        const username = await this.getUsernameForSlug(userId);
        slug = this.buildUserQuizSlug(title, username);
        let existingSlug = await this.quizRepository.findOne({ where: { slug } });
        while (existingSlug) {
          slug = this.buildUserQuizSlug(title, username);
          existingSlug = await this.quizRepository.findOne({ where: { slug } });
        }
      } else {
        slug = generateSlug(title);
        let existingSlug = await this.quizRepository.findOne({ where: { slug } });
        while (existingSlug) {
          slug = generateUniqueSlug(title);
          existingSlug = await this.quizRepository.findOne({ where: { slug } });
        }
      }
      quiz.slug = slug;
      quiz.createdBy = userId;
      quiz.level = createQuizDto.level ?? DifficultyLevelEnum.Easy;
      console.log('QuizBuilder #4: QuizToSave', quiz);
      return this.dataSource.transaction(async (manager) => {
        const savedQuizzes = await manager.save(Quiz, quiz);
        console.log('QuizBuilder #5: savedQuizzes', savedQuizzes);
        const quizQuestion: QuizQuestion[] = [];
        const quizSubject: QuizSubject[] = [];
        const quizTopic: QuizTopic[] = [];
        for (const question of questions) {
          const quizQuestionItem = new QuizQuestion();
          quizQuestionItem.quizId = savedQuizzes.id;
          quizQuestionItem.questionId = question.id;
          quizQuestion.push(quizQuestionItem);
        }

        await manager.save(QuizQuestion, quizQuestion);
        if (subjectIds && subjectIds.length > 0) {
          for (const id of subjectIds) {
            const quizSubjectItem = new QuizSubject();
            quizSubjectItem.quizId = savedQuizzes.id;
            quizSubjectItem.subjectId = id;
            quizSubject.push(quizSubjectItem);
          }
          await manager.save(QuizSubject, quizSubject);
        }
        if (topicIds && topicIds.length > 0) {
          for (const id of topicIds) {
            const quizTopicItem = new QuizTopic();
            quizTopicItem.quizId = savedQuizzes.id;
            quizTopicItem.topicId = id;
            quizTopic.push(quizTopicItem);
          }
          await manager.save(QuizTopic, quizTopic);
        }

        // Create quiz settings if Standard quiz (settings optional in payload, defaults applied in DTO)
        if (createQuizDto.quizType === 'Standard' && createQuizDto.settings) {
          const quizSettings = manager.create(QuizSettings, {
            ...createQuizDto.settings,
            quizId: savedQuizzes.id,
          });
          savedQuizzes.settings = await manager.save(
            QuizSettings,
            quizSettings,
          );
        }

        const response: any = {
          message: questionObj?.message
            ? questionObj?.message
            : 'Quiz created successfully.',
          quiz: savedQuizzes,
        };
        return response;
      });
    } catch (error) {
      console.log('QuizBuilder #6: ERROR', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new AppCustomException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to save quiz and questions: ' + errorMessage,
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

  /**
   * One-time, system-generated skill check for a newly registered user, scoped to
   * every subject under their job role. Idempotent — calling this again after one
   * already exists just returns it rather than generating a second one. Takeable
   * once: a QuizSettings row with maxAttempts=1 is created directly here rather than
   * via createQuiz()'s own settings step, since that step only ever runs for
   * quizType=Standard — changing that condition would affect every other UserQuiz
   * caller, not just this one.
   */
  async createInitialAssessmentQuiz(
    userId: number,
    firstName: string,
    jobRoleId: number,
  ): Promise<{ message: string; quiz: Quiz }> {
    const existing = await this.quizRepository.findOne({
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

    // createQuiz() is declared as Promise<Quiz> but actually resolves
    // { message, quiz } at runtime (pre-existing mismatch — see how
    // quiz.controller.ts's own create-quiz route already works around it).
    const created: any = await this.createQuiz(createQuizDto, userId);
    const quiz: Quiz = created.quiz;

    // createQuiz() only fails if it finds zero questions — fewer than the
    // requested 20 (e.g. a job role whose subjects only have 12 available) is
    // allowed and already succeeds. Reflect the ACTUAL count here rather than
    // hardcoding 20, since that's what really got saved as QuizQuestion rows.
    const actualQuestionCount = await this.quizQuestionRepo.count({
      where: { quizId: quiz.id },
    });

    const quizSettings = this.quizSettingsRepository.create({
      quizId: quiz.id,
      numQuestions: actualQuestionCount,
      maxAttempts: 1,
    });
    quiz.settings = await this.quizSettingsRepository.save(quizSettings);

    return { message: 'Initial assessment generated successfully.', quiz };
  }

  //Generate a server level feedback utility
  async submitQuiz(
    submitQuizDto: SubmitQuizDto,
  ): Promise<QuizResult & { newlyEarned?: NewlyEarnedDto | null }> {
    // Enforce QuizSettings.maxAttempts (stored but previously never checked anywhere) —
    // without this, XP/leaderboard rank can be farmed for free by simply resubmitting
    // the same quiz. Quizzes without a settings row are left unrestricted (unchanged
    // behavior for legacy/ad-hoc quizzes that predate QuizSettings).
    const settings = await this.quizSettingsRepository.findOne({
      where: { quizId: submitQuizDto?.quizId },
      select: ['maxAttempts'],
    });
    if (settings?.maxAttempts) {
      const priorAttempts = await this.quizResultRepository.count({
        where: { quizId: submitQuizDto?.quizId, userId: submitQuizDto?.userId },
      });
      if (priorAttempts >= settings.maxAttempts) {
        throw new AppCustomException(
          HttpStatus.FORBIDDEN,
          `Maximum attempts (${settings.maxAttempts}) reached for this quiz.`,
        );
      }
    }

    // total/correct/wrong/unanswered/score must never be trusted from the client — they're
    // recomputed here from the submitted attempts using the same generateScore() formula
    // every other scoring surface (subject dashboard, job-role readiness, etc.) uses, so a
    // quiz's own result and the dashboards built from it can never silently diverge again.
    const attempts = submitQuizDto?.attempts ?? [];
    const total = attempts.length;
    const correct = attempts.filter((a) => a?.isCorrect === true).length;
    const unanswered = attempts.filter((a) => a?.isSkipped === true).length;
    const wrong = attempts.filter((a) => a?.isSkipped !== true && a?.isCorrect !== true).length;
    const score = generateScore(total, correct, wrong);

    let questionResult: QuizResult;
    // Populated inside the transaction with the *actual* saved QuestionAttempt ids —
    // the achievement layer needs these to tell "the correct answer I just saved"
    // apart from "a correct answer this user already had on record for this question"
    // (see EvaluateAfterQuizAttempt.id).
    let savedAttempts: { id: number; questionId: number; isCorrect: boolean; isSkipped: boolean; hintUsed: boolean }[] = [];
    try {
      questionResult = await this.dataSource.transaction(async (manager) => {
        const result = manager.create(QuizResult, {
          quizId: submitQuizDto?.quizId,
          userId: submitQuizDto?.userId,
          resultCode: generate6DigitNumber(),
          total,
          correct,
          wrong,
          unanswered,
          timeSpent: submitQuizDto?.timeSpent,
          score,
        });

        const savedResult = await manager.save(QuizResult, result);

        const quiz = await manager.findOne(Quiz, {
          where: { id: submitQuizDto?.quizId },
          select: ['id', 'title'],
        });

        await this.notificationService.notifyQuizCompleted(
          submitQuizDto?.userId,
          quiz?.title ?? 'Quiz',
          score,
          submitQuizDto?.quizId,
        );

        // 3. Save QuestionAttempts
        for (const attempt of attempts) {
          const questionAttempt = manager.create(QuestionAttempt, {
            userId: submitQuizDto?.userId,
            quizId: submitQuizDto?.quizId,
            questionId: attempt.questionId,
            selectedOption: attempt?.selectedOption,
            timeTaken: attempt?.timeTaken,
            isSkipped: attempt?.isSkipped,
            hintUsed: attempt?.hintUsed,
            isCorrect: attempt?.isCorrect,
            answer: attempt?.answer,
          });
          const saved = await manager.save(QuestionAttempt, questionAttempt);
          savedAttempts.push({
            id: saved.id,
            questionId: attempt.questionId,
            isCorrect: attempt?.isCorrect,
            isSkipped: attempt?.isSkipped,
            hintUsed: attempt?.hintUsed,
          });
        }

        return savedResult;
      });
    } catch (error) {
      console.log('QuizBuilder #6: Exception', error);
      throw new AppCustomException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to submit quiz result.',
      );
    }

    // Achievement evaluation (XP, streak, badges, certificates) runs after the
    // QuestionAttempt/QuizResult transaction has already committed, and must never
    // fail the quiz submission itself — those rows are the ground truth the rest
    // of the app derives everything from, so losing them over a badge-rule bug
    // would be strictly worse than just missing a badge this one time.
    let newlyEarned: NewlyEarnedDto | null = null;
    try {
      newlyEarned = await this.achievementService.evaluateAfterQuiz({
        userId: submitQuizDto?.userId,
        score,
        attempts: savedAttempts,
      });
    } catch (error) {
      console.log('QuizBuilder #6: Achievement evaluation error', error);
    }

    return { ...questionResult, newlyEarned };
  }


  async getUserQuizzes(userId: number,isAdmin: boolean,): Promise<any> {
    const query = await this.quizRepository
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


  async getPublishedQuizzes(
  filters: PublishedQuizFilterDto,
): Promise<any[]> {

  const query = this.quizRepository
    .createQueryBuilder('quiz')
    .distinct(true)

    .leftJoinAndSelect(
      'quiz.settings',
      'settings',
    )

    .leftJoinAndSelect(
      'quiz.userCreatedBy',
      'userCreatedBy',
    )

    // Subject Mapping
    .leftJoin(
      QuizSubject,
      'filterQuizSubjects',
      'filterQuizSubjects.quizId = quiz.id',
    )
    .leftJoin(
      QuizSubject,
      'quizSubjects',
      'quizSubjects.quizId = quiz.id',
    )
    .leftJoinAndMapMany(
    'quiz.subjects',
    Subject,
    'subject',
    'subject.id = quizSubjects.subjectId',
  )

    // Topic Mapping
    .leftJoin(
      QuizTopic,
      'quizTopics',
      'quizTopics.quizId = quiz.id',
    )

    .leftJoin(
  JobRoleSubject,
  'jobRoleSubjects',
  `
  jobRoleSubjects.subjectId =
  filterQuizSubjects.subjectId
  `,
)

    .where(
      'quiz.isPublished = :isPublished',
      {
        isPublished: true,
      },
    )

    .andWhere(
      'quiz.quizType = :quizType',
      {
        quizType:
          QuizTypeEnum.Standard,
      },
    );

  /*
  JOB ROLE FILTER
*/
if (
  filters.jobRoleId &&
  Number(filters.jobRoleId) !== 0
) {
  query.andWhere(
    'jobRoleSubjects.jobRoleId = :jobRoleId',
    {
      jobRoleId:
        filters.jobRoleId,
    },
  );
}  

/*
  QUIZ SETTINGS MODE FILTER
*/
if (filters.mode) {
  query.andWhere(
    'settings.mode = :mode',
    {
      mode: filters.mode,
    },
  );
}

  /*
    SUBJECT FILTER
    subjectId = 0 => ignore filter
  */
  if (
    filters.subjectId &&
    Number(filters.subjectId) !== 0
  ) {

    query.andWhere(
      'filterQuizSubjects.subjectId = :subjectId',
      {
        subjectId:
          filters.subjectId,
      },
    );
  }

  /*
    TOPIC FILTER
    topicId = 0 => ignore filter
  */
  if (
    filters.topicId &&
    Number(filters.topicId) !== 0
  ) {

    query.andWhere(
       `
  quizTopics.topicId = :topicId
  AND
  jobRoleSubjects.topicId =
  quizTopics.topicId
  `,
      {
        topicId:
          filters.topicId,
      },
    );
  }

  /*
    If filters are empty/0
    => no extra filters
    => fetch all quizzes
  */

  query.orderBy(
    'quiz.createdAt',
    'DESC',
  );

  const quizzes =
    await query.getMany();

  if (!quizzes.length) {
    return [];
  }

  const quizIds = quizzes.map(
    (quiz) => quiz.id,
  );

  /*
    TOTAL ATTEMPTS
  */
  const attempts =
    await this.quizResultRepository
      .createQueryBuilder('qr')
      .select(
        'qr.quizId',
        'quizId',
      )
      .addSelect(
        'COUNT(qr.id)',
        'totalAttempts',
      )
      .where(
        'qr.quizId IN (:...quizIds)',
        {
          quizIds,
        },
      )
      .groupBy('qr.quizId')
      .getRawMany();

  const attemptMap = new Map<
    number,
    number
  >();

  for (const item of attempts) {

    attemptMap.set(
      Number(item.quizId),
      Number(item.totalAttempts),
    );
  }

  /*
    TOTAL QUESTIONS
  */
  const questionCounts =
    await this.quizQuestionRepo
      .createQueryBuilder('qq')
      .select(
        'qq.quizId',
        'quizId',
      )
      .addSelect(
        'COUNT(qq.id)',
        'totalQuestions',
      )
      .where(
        'qq.quizId IN (:...quizIds)',
        {
          quizIds,
        },
      )
      .groupBy('qq.quizId')
      .getRawMany();

  const questionCountMap =
    new Map<number, number>();

  for (const item of questionCounts) {

    questionCountMap.set(
      Number(item.quizId),
      Number(item.totalQuestions),
    );
  }

  /*
    FINAL RESPONSE
  */
  return quizzes.map(
    (quiz: any) => {

      const {
        userCreatedBy,
        ...quizData
      } = quiz;

      const createdByName = `${
        userCreatedBy?.firstName || ''
      } ${
        userCreatedBy?.lastName || ''
      }`.trim();

      return {

        ...quizData,

        createdBy:
          userCreatedBy
            ? {
                id:
                  userCreatedBy.id,

                name:
                  createdByName ||
                  userCreatedBy.username ||
                  null,
              }
            : null,

        status:
          quiz.isPublished
            ? 'Published'
            : 'Draft',

        totalQuestions:
          questionCountMap.get(
            quiz.id,
          ) || 0,

        totalAttempts:
          attemptMap.get(
            quiz.id,
          ) || 0,

        settings:
          quiz.settings || null,

        subjects:
      quiz?.subjects?.map(
        (subject: any) => ({
          id: subject.id,
          title: subject.title,
          colour: subject.color,
          image: subject.image,
        }),
      ) || [],
      };
    },
  );
}
  

  async updateQuiz(
    quizId: number,
    updateQuizDto: UpdateQuizDto,
    userId: number,
  ): Promise<Quiz> {
    // Fetch the quiz with createdBy field selected (it has select: false in entity)
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

    // Parse IDs from strings if provided
    let subjectIds: number[] = [];
    let topicIds: number[] = [];
    let questionIds: number[] = updateQuizDto?.questionIds ?? [];

    if (updateQuizDto?.subjectIds) {
      const subjectStr = String(updateQuizDto.subjectIds);
      subjectIds = subjectStr
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0);
    }

    if (updateQuizDto?.topicIds) {
      const topicStr = String(updateQuizDto.topicIds);
      topicIds = topicStr
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => Number.isInteger(id) && id > 0);
    }

    // Update quiz properties
    if (updateQuizDto.title) {
      quiz.title = updateQuizDto.title;
      // Generate new slug if title changed
      let slug = generateSlug(updateQuizDto.title);
      let existingSlug = await this.quizRepository.findOne({
        where: { slug },
      });
      while (existingSlug && existingSlug.id !== quizId) {
        slug = generateUniqueSlug(updateQuizDto.title);
        existingSlug = await this.quizRepository.findOne({
          where: { slug },
        });
      }
      quiz.slug = slug;
    }

    if (updateQuizDto.shortDesc !== undefined) {
      quiz.shortDesc = updateQuizDto.shortDesc;
    }

    if (updateQuizDto.description !== undefined) {
      quiz.description = updateQuizDto.description;
    }

    if (updateQuizDto.label !== undefined) {
      quiz.label = updateQuizDto.label;
    }

    if (updateQuizDto.isPublished !== undefined) {
      quiz.isPublished = updateQuizDto.isPublished;
    }

    if (updateQuizDto.goal !== undefined) {
      quiz.goal = updateQuizDto.goal;
    }

     if (updateQuizDto.category !== undefined) {
      quiz.category = updateQuizDto.category;
    }

    if (updateQuizDto.level !== undefined) {
      quiz.level = updateQuizDto.level;
    }


    return this.dataSource.transaction(async (manager) => {
      // Save updated quiz
      const updatedQuiz = await manager.save(Quiz, quiz);

      // Update questions if provided
      if (questionIds.length > 0) {
        // Delete existing quiz questions
        await manager.delete(QuizQuestion, { quizId: updatedQuiz.id });

        // Create new quiz questions
        const quizQuestions: QuizQuestion[] = [];
        for (const qId of questionIds) {
          const quizQuestion = new QuizQuestion();
          quizQuestion.quizId = updatedQuiz.id;
          quizQuestion.questionId = qId;
          quizQuestions.push(quizQuestion);
        }
        await manager.save(QuizQuestion, quizQuestions);
      }

      // Update subjects if provided
      if (subjectIds.length > 0 || updateQuizDto.subjectIds !== undefined) {
        // Delete existing quiz subjects
        await manager.delete(QuizSubject, { quizId: updatedQuiz.id });

        // Create new quiz subjects
        if (subjectIds.length > 0) {
          const quizSubjects: QuizSubject[] = [];
          for (const sId of subjectIds) {
            const quizSubject = new QuizSubject();
            quizSubject.quizId = updatedQuiz.id;
            quizSubject.subjectId = sId;
            quizSubjects.push(quizSubject);
          }
          await manager.save(QuizSubject, quizSubjects);
        }
      }

      // Update topics if provided
      if (topicIds.length > 0 || updateQuizDto.topicIds !== undefined) {
        // Delete existing quiz topics
        await manager.delete(QuizTopic, { quizId: updatedQuiz.id });

        // Create new quiz topics
        if (topicIds.length > 0) {
          const quizTopics: QuizTopic[] = [];
          for (const tId of topicIds) {
            const quizTopic = new QuizTopic();
            quizTopic.quizId = updatedQuiz.id;
            quizTopic.topicId = tId;
            quizTopics.push(quizTopic);
          }
          await manager.save(QuizTopic, quizTopics);
        }
      }

      // Update settings if provided
      if (updateQuizDto.settings) {
        const existingSettings = await manager.findOne(QuizSettings, {
          where: { quizId: updatedQuiz.id },
        });

        if (existingSettings) {
          // Update existing settings
          Object.assign(existingSettings, updateQuizDto.settings);
          await manager.save(QuizSettings, existingSettings);
        } else {
          // Create new settings
          const quizSettings = manager.create(QuizSettings, {
            ...updateQuizDto.settings,
            quizId: updatedQuiz.id,
          });
          await manager.save(QuizSettings, quizSettings);
        }
      }

      return updatedQuiz;
    });
  }
}