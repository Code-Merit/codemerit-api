import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';
import { LessonSection } from 'src/common/typeorm/entities/lesson-section.entity';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import {
  generateSlug,
  generateUniqueSlug,
} from 'src/common/utils/slugify.util';
import { DataSource, In, Repository } from 'typeorm';
import { CreateLessonDto } from '../dtos/create-lesson.dto';
import { GetLessonsDto } from '../dtos/get-lessons.dto';
import { UpdateLessonProgressDto } from '../dtos/update-lesson-progress.dto';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';
import { BASIC_PREMIUM_SUBJECT_CONTENT_CEILING } from 'src/modules/skill-enrollment/constants/skill-enrollment.constants';
import { FreeLessonView } from 'src/common/typeorm/entities/free-lesson-view.entity';
import { EnrollmentTierEnum, isTierAtLeast } from 'src/common/enum/enrollment-tier.enum';

interface LessonAccessResult {
  locked: boolean;
  isNewFreeGrant: boolean;
  tier: EnrollmentTierEnum | null;
}

interface FreeLessonContext {
  viewedLessonIdsEver: Set<number>;
  viewedCountBySubjectEver: Map<number, number>;
  todaysViewedCount: number;
  lessonCountBySubject: Map<number, number>;
}

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(UserLessonTracker)
    private readonly userLessonTrackerRepo: Repository<UserLessonTracker>,
    @InjectRepository(FreeLessonView)
    private readonly freeLessonViewRepo: Repository<FreeLessonView>,
    private readonly dataSource: DataSource,
    private readonly skillEnrollmentService: SkillEnrollmentService,
  ) { }

  /** Comic-format lessons are always free regardless of subject. Non-premium
   * (`Subject.isPremium: false`) subjects are unlimited for everyone at any tier,
   * including no enrollment at all. Otherwise: `tier === null` (no active enrollment
   * for this subject at all — not even Basic) is locked outright, with no free peek —
   * enrolling in at least Basic is required first (see enrollBasic()). tier >= Pro is
   * fully unlocked; Basic and Curious are capped daily (their own configured
   * dailyLessonCap), and Basic additionally has a cumulative "seen no more than 40% of
   * this subject's lessons, ever" ceiling — see BASIC_PREMIUM_SUBJECT_CONTENT_CEILING.
   * A lesson already granted before (any date) always stays free, regardless of
   * today's/cumulative counts. This is deliberately a *different* concept from the
   * looser "what has this user engaged with" personalization signal used elsewhere
   * in this service (see getEnrolledSubjectIds() below) — this method is the strict,
   * real-access check. */
  private evaluateLessonAccess(
    lesson: Lesson,
    tier: EnrollmentTierEnum | null,
    caps: { dailyLessonCap: number } | null,
    ctx: FreeLessonContext,
  ): { locked: boolean; isNewFreeGrant: boolean } {
    if (lesson.format === 'comic') return { locked: false, isNewFreeGrant: false };
    if (!lesson.subject?.isPremium) return { locked: false, isNewFreeGrant: false };
    if (tier === null) return { locked: true, isNewFreeGrant: false };
    if (isTierAtLeast(tier, EnrollmentTierEnum.Pro)) return { locked: false, isNewFreeGrant: false };

    if (ctx.viewedLessonIdsEver.has(lesson.id)) return { locked: false, isNewFreeGrant: false };

    if (tier === EnrollmentTierEnum.Basic) {
      const viewed = ctx.viewedCountBySubjectEver.get(lesson.subjectId) ?? 0;
      const total = ctx.lessonCountBySubject.get(lesson.subjectId) ?? 0;
      if (total > 0 && viewed / total >= BASIC_PREMIUM_SUBJECT_CONTENT_CEILING) {
        return { locked: true, isNewFreeGrant: false };
      }
    }

    const dailyCap = caps?.dailyLessonCap ?? Infinity;
    if (ctx.todaysViewedCount >= dailyCap) {
      return { locked: true, isNewFreeGrant: false };
    }

    return { locked: false, isNewFreeGrant: true };
  }

  /** Batched access computation for a set of lessons in one pass (no N+1 queries).
   * `ctx.todaysViewedCount` is intentionally NOT incremented while iterating — for a
   * list of several not-yet-seen lessons, each is evaluated independently against the
   * same starting count, so the list can optimistically show more than one as
   * unlocked even though opening all of them would eventually hit the cap (list is
   * optimistic, the detail view — findBySlug, which actually records — is
   * authoritative). */
  private async computeLessonAccessBatch(
    lessons: Lesson[],
    userId: number | undefined,
  ): Promise<Map<number, LessonAccessResult>> {
    const tierMap = userId
      ? await this.skillEnrollmentService.getSubjectTierMap(userId)
      : new Map<number, EnrollmentTierEnum>();

    const relevantSubjectIds = new Set<number>();
    for (const lesson of lessons) {
      if (lesson.format === 'comic' || !lesson.subject?.isPremium) continue;
      const tier = tierMap.get(lesson.subjectId) ?? null;
      // No enrollment at all locks outright (handled directly in evaluateLessonAccess)
      // — no need to pull free-view history for it.
      if (tier && !isTierAtLeast(tier, EnrollmentTierEnum.Pro)) relevantSubjectIds.add(lesson.subjectId);
    }

    const ctx: FreeLessonContext = {
      viewedLessonIdsEver: new Set(),
      viewedCountBySubjectEver: new Map(),
      todaysViewedCount: 0,
      lessonCountBySubject: new Map(),
    };

    if (userId && relevantSubjectIds.size) {
      const [allViews, counts] = await Promise.all([
        this.freeLessonViewRepo.find({ where: { userId } }),
        this.lessonRepository
          .createQueryBuilder('l')
          .select('l.subjectId', 'subjectId')
          .addSelect('COUNT(*)', 'cnt')
          .where('l.subjectId IN (:...ids)', { ids: Array.from(relevantSubjectIds) })
          .andWhere("l.format != 'comic'")
          .groupBy('l.subjectId')
          .getRawMany(),
      ]);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      for (const view of allViews) {
        ctx.viewedLessonIdsEver.add(view.lessonId);
        ctx.viewedCountBySubjectEver.set(
          view.subjectId,
          (ctx.viewedCountBySubjectEver.get(view.subjectId) ?? 0) + 1,
        );
        if (view.createdAt >= startOfDay) ctx.todaysViewedCount += 1;
      }
      counts.forEach((c) => ctx.lessonCountBySubject.set(+c.subjectId, +c.cnt));
    }

    const capsCache = new Map<EnrollmentTierEnum, { dailyQuizCap: number; dailyLessonCap: number } | null>();
    const result = new Map<number, LessonAccessResult>();
    for (const lesson of lessons) {
      const tier = tierMap.get(lesson.subjectId) ?? null;
      let caps: { dailyQuizCap: number; dailyLessonCap: number } | null = null;
      if (tier) {
        caps = capsCache.get(tier) ?? null;
        if (!capsCache.has(tier)) {
          caps = await this.skillEnrollmentService.getCapsForTier(tier);
          capsCache.set(tier, caps);
        }
      }
      const { locked, isNewFreeGrant } = this.evaluateLessonAccess(lesson, tier, caps, ctx);
      result.set(lesson.id, { locked, isNewFreeGrant, tier });
    }
    return result;
  }

  private async evaluateSingleLessonAccess(
    lesson: Lesson,
    userId: number | undefined,
  ): Promise<LessonAccessResult> {
    const map = await this.computeLessonAccessBatch([lesson], userId);
    return map.get(lesson.id)!;
  }

  /** Records the free-tier "spend" for a lesson computeLessonAccessBatch/
   * evaluateSingleLessonAccess just granted for the first time — the only place a
   * FreeLessonView row is ever inserted. */
  private async recordFreeLessonView(userId: number, lesson: Lesson): Promise<void> {
    await this.freeLessonViewRepo.save(
      this.freeLessonViewRepo.create({
        userId,
        lessonId: lesson.id,
        subjectId: lesson.subjectId,
      }),
    );
  }

  /** With no userId, or a userId with no subject enrollment, `fetch=all` falls back to a random
   * discovery feed (public/empty-profile browsing). Once a user has enrolled subjects (directly,
   * or via a job role's subject list), `fetch=all` means literally all lessons across those
   * subjects — deterministically ordered, no random filler from unrelated subjects — while a plain
   * `n` (no `fetch=all`) stays a random sample for recommendation-style feeds. */
  async findLessons(dto: GetLessonsDto, userId?: number): Promise<any[]> {
    const limit = Number(dto?.n ?? 10);
    const fetchAll = dto?.fetch === 'all';

    const enrolledSubjectIds = userId ? await this.getEnrolledSubjectIds(userId) : [];

    let lessons: Lesson[];
    if (!enrolledSubjectIds.length) {
      lessons = fetchAll || !userId ? await this.getRandomLessons(limit) : [];
    } else if (fetchAll) {
      lessons = await this.getLessonsBySubjects(enrolledSubjectIds, limit);
    } else {
      lessons = await this.getRandomLessonsBySubjects(enrolledSubjectIds, limit);
    }

    const trackerMap = userId
      ? await this.getTrackerMap(userId, lessons.map((lesson) => lesson.id))
      : new Map<number, UserLessonTracker>();

    // List view only — never records a FreeLessonView (see computeLessonAccessBatch's
    // docstring on why this is deliberately optimistic).
    const accessMap = await this.computeLessonAccessBatch(lessons, userId);

    return lessons.map((lesson) =>
      this.toLessonSummaryDto(
        lesson,
        trackerMap.get(lesson.id),
        accessMap.get(lesson.id)?.locked ?? true,
      ),
    );
  }

  /** `locked` lessons (paid Tutorial/Reference content the caller hasn't enrolled for)
   * still surface their metadata for a "browse the catalog, see what's locked" UX, but
   * `sections` is stripped so the actual content is never sent to a caller without access. */
  private toLessonSummaryDto(lesson: Lesson, tracker?: UserLessonTracker, locked = false) {
    return {
      ...lesson,
      subject: lesson.subject
        ? {
          id: lesson.subject.id,
          title: lesson.subject.title,
          image: lesson.subject.image,
        }
        : null,
      topic: lesson.topic
        ? {
          id: lesson.topic.id,
          title: lesson.topic.title,
          image: lesson.topic.image,
        }
        : null,
      user: lesson.user
        ? {
          id: lesson.user.id,
          firstName: lesson.user.firstName,
          lastName: lesson.user.lastName,
        }
        : null,
      sections: locked ? [] : lesson.sections || [],
      locked,
      myProgress: tracker ? this.toTrackerDto(tracker, lesson.id) : null,
    };
  }

  async createLesson(dto: CreateLessonDto, userId: number): Promise<Lesson> {
    const subjectId = dto.subjectId ?? dto.subject;
    const topicId = dto.topicId ?? dto.topic;

    if (!subjectId) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Lesson subject is required.',
      );
    }

    if (!topicId) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Lesson topic is required.',
      );
    }

    if (!dto.descriptions?.length) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'At least one lesson description is required.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      let slug = generateSlug(dto.title);
      let existingSlug = await manager.findOne(Lesson, { where: { slug } });

      while (existingSlug) {
        slug = generateUniqueSlug(dto.title);
        existingSlug = await manager.findOne(Lesson, { where: { slug } });
      }

      const lesson = manager.create(Lesson, {
        title: dto.title,
        subjectId,
        topicId,
        slug,
        level: dto.level,
        userId,
      });

      const savedLesson = await manager.save(Lesson, lesson);

      const sections = dto.descriptions.map((description) =>
        manager.create(LessonSection, {
          lessonId: savedLesson.id,
          title: description.title,
          description: description.content,
        }),
      );

      await manager.save(LessonSection, sections);

      return manager.findOne(Lesson, {
        where: { id: savedLesson.id },
        relations: ['sections'],
      });
    });
  }

  async findBySlug(slug: string, userId?: number): Promise<any> {
    const lesson = await this.findLessonEntityOrThrow(slug);

    // Read-only: looking at a lesson never creates/mutates a tracker row on its own — that only
    // happens through the explicit recordLessonAccess() call below, so a page refresh or a bot
    // crawling public lesson pages never fabricates progress history.
    const myTracker = userId
      ? await this.userLessonTrackerRepo.findOne({ where: { userId, lessonId: lesson.id } })
      : undefined;

    // The one read path that actually "spends" a free view — this is where a
    // not-yet-seen lesson's FreeLessonView row gets recorded, unlike findLessons.
    const access = await this.evaluateSingleLessonAccess(lesson, userId);
    if (access.isNewFreeGrant && userId) {
      await this.recordFreeLessonView(userId, lesson);
    }

    return this.toLessonSummaryDto(lesson, myTracker, access.locked);
  }

  /** Throws 403 if `lesson` is paid content the caller can't currently access. Shared
   * by the two actions that actually consume a lesson (recording access, updating
   * progress) — unlike findBySlug/findLessons, which return a locked preview instead
   * of erroring, since those are catalog-browsing reads rather than "consume this
   * content" actions. Also records a fresh free grant if this endpoint is called
   * standalone (without a prior findBySlug), so it stays usable on its own. */
  private async assertLessonUnlocked(userId: number, lesson: Lesson): Promise<void> {
    const access = await this.evaluateSingleLessonAccess(lesson, userId);
    if (access.locked) {
      const subjectTitle = lesson.subject?.title ?? 'this subject';
      const message = access.tier
        ? `This lesson requires a higher plan for "${subjectTitle}" — you're currently on ${access.tier}. Upgrade to continue.`
        : `You're not enrolled in "${subjectTitle}" yet. Enroll in the free Basic plan (or higher) to access it.`;
      throw new AppCustomException(HttpStatus.FORBIDDEN, message);
    }
    if (access.isNewFreeGrant) {
      await this.recordFreeLessonView(userId, lesson);
    }
  }

  /** Called when a user opens a lesson: creates the tracker on first view (status Pending,
   * views 1) or increments `views` on every view after that. Never touches status/progressPercent
   * — those only change through updateLessonProgress(), so "I opened it" and "I made progress on
   * it" stay two independently meaningful signals instead of one call trying to mean both. */
  async recordLessonAccess(userId: number, slug: string): Promise<any> {
    const lesson = await this.findLessonEntityOrThrow(slug);
    await this.assertLessonUnlocked(userId, lesson);
    const tracker = await this.getOrCreateTracker(userId, lesson.id);

    await this.userLessonTrackerRepo.increment({ id: tracker.id }, 'views', 1);
    const updated = await this.userLessonTrackerRepo.findOneBy({ id: tracker.id });

    return this.toTrackerDto(updated, lesson.id);
  }

  /** Updates a user's own progress on a lesson — completion status and/or a 0-100 percent.
   * Creates the tracker on the fly if the user jumps straight to e.g. "mark complete" without a
   * prior recordLessonAccess() call, so this endpoint is usable standalone. */
  async updateLessonProgress(
    userId: number,
    slug: string,
    dto: UpdateLessonProgressDto,
  ): Promise<any> {
    if (dto.status === undefined && dto.progressPercent === undefined) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Provide at least a status or a progressPercent to update lesson progress.',
      );
    }

    const lesson = await this.findLessonEntityOrThrow(slug);
    await this.assertLessonUnlocked(userId, lesson);
    const tracker = await this.getOrCreateTracker(userId, lesson.id);
    const changes = this.deriveProgressUpdate(tracker, dto);

    await this.userLessonTrackerRepo.update(tracker.id, changes);
    const updated = await this.userLessonTrackerRepo.findOneBy({ id: tracker.id });

    return this.toTrackerDto(updated, lesson.id);
  }

  private async findLessonEntityOrThrow(slug: string): Promise<Lesson> {
    const lesson = await this.lessonRepository
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.subject', 'subject')
      .leftJoinAndSelect('lesson.topic', 'topic')
      .leftJoinAndSelect('lesson.user', 'user')
      .leftJoinAndSelect('lesson.sections', 'sections')
      .where('lesson.slug = :slug', { slug })
      .getOne();

    if (!lesson) {
      throw new AppCustomException(
        HttpStatus.NOT_FOUND,
        `Lesson with slug "${slug}" not found.`,
      );
    }

    return lesson;
  }

  /** Finds the (userId, lessonId) tracker or creates it. The @Unique(['userId','lessonId'])
   * constraint on the entity means two concurrent first-accesses (e.g. two tabs) can race to
   * insert — the loser's save() throws a duplicate-key error, which is caught here and resolved
   * by re-reading the row the winner just created, rather than surfacing a spurious 400 to a user
   * who did nothing wrong. */
  private async getOrCreateTracker(
    userId: number,
    lessonId: number,
  ): Promise<UserLessonTracker> {
    const existing = await this.userLessonTrackerRepo.findOne({
      where: { userId, lessonId },
    });
    if (existing) return existing;

    try {
      return await this.userLessonTrackerRepo.save(
        this.userLessonTrackerRepo.create({
          userId,
          lessonId,
          views: 0,
          status: UserLessonTrackerStatusEnum.Pending,
          progressPercent: 0,
        }),
      );
    } catch (err) {
      const createdByRace = await this.userLessonTrackerRepo.findOne({
        where: { userId, lessonId },
      });
      if (createdByRace) return createdByRace;
      throw err;
    }
  }

  /** Reconciles a status/percent update into one consistent pair. Rules, in order:
   *  - explicit status: Completed always forces percent to 100; Pending (with no percent given
   *    in the same call) resets percent to 0; any other explicit status leaves percent untouched.
   *  - percent only (no explicit status): derives status from the percent's value (100 →
   *    Completed, 0 → Pending, else → Read) — UNLESS the current status is the manually-set
   *    NeedsRevisit or Reported, which a stray progress ping should never silently clear. */
  private deriveProgressUpdate(
    current: UserLessonTracker,
    dto: UpdateLessonProgressDto,
  ): Pick<UserLessonTracker, 'status' | 'progressPercent'> {
    let status = dto.status ?? current.status;
    let progressPercent = dto.progressPercent ?? current.progressPercent;

    if (dto.status !== undefined) {
      if (dto.status === UserLessonTrackerStatusEnum.Completed) {
        progressPercent = 100;
      } else if (
        dto.status === UserLessonTrackerStatusEnum.Pending &&
        dto.progressPercent === undefined
      ) {
        progressPercent = 0;
      }
    } else {
      const isManualFlag =
        current.status === UserLessonTrackerStatusEnum.NeedsRevisit ||
        current.status === UserLessonTrackerStatusEnum.Reported;

      if (!isManualFlag) {
        if (progressPercent >= 100) status = UserLessonTrackerStatusEnum.Completed;
        else if (progressPercent <= 0) status = UserLessonTrackerStatusEnum.Pending;
        else status = UserLessonTrackerStatusEnum.Read;
      }
    }

    return { status, progressPercent };
  }

  private toTrackerDto(tracker: UserLessonTracker, lessonId: number) {
    return {
      lessonId,
      status: tracker.status,
      progressPercent: tracker.progressPercent,
      views: tracker.views,
      notes: tracker.notes,
      updatedAt: tracker.updatedAt,
    };
  }

  /** Subjects the user actually holds a SkillEnrollment for — narrowed to real
   * enrollment only, per the locked design decision. A job role the user has merely
   * *targeted* (UserJobRole) no longer feeds this list on its own; targeting a role
   * carries no access, so it shouldn't drive what shows up here either — that's now
   * purely a Career Dashboard / goal-setting signal. Delegates to
   * SkillEnrollmentService rather than querying SkillEnrollment directly, matching
   * how every other consumer in this codebase reaches it. */
  private async getEnrolledSubjectIds(userId: number): Promise<number[]> {
    return this.skillEnrollmentService.getEnrolledSubjectIds(userId);
  }

  /** lessonId -> this user's tracker row, for stamping `myProgress` onto a batch of lessons without
   * an N+1 query per lesson. */
  private async getTrackerMap(
    userId: number,
    lessonIds: number[],
  ): Promise<Map<number, UserLessonTracker>> {
    if (!lessonIds.length) return new Map();

    const trackers = await this.userLessonTrackerRepo.find({
      where: { userId, lessonId: In(lessonIds) },
    });

    return new Map(trackers.map((tracker) => [tracker.lessonId, tracker]));
  }

  private getRandomLessons(limit: number, excludeIds: number[] = []) {
    const query = this.lessonRepository
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.subject', 'subject')
      .leftJoinAndSelect('lesson.topic', 'topic')
      .leftJoinAndSelect('lesson.user', 'user')
      .leftJoinAndSelect('lesson.sections', 'sections')
      .orderBy('RAND()')
      .take(limit);

    if (excludeIds.length) {
      query.where('lesson.id NOT IN (:...excludeIds)', { excludeIds });
    }

    return query.getMany();
  }

  private getRandomLessonsBySubjects(subjectIds: number[], limit: number) {
    return this.lessonRepository
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.subject', 'subject')
      .leftJoinAndSelect('lesson.topic', 'topic')
      .leftJoinAndSelect('lesson.user', 'user')
      .leftJoinAndSelect('lesson.sections', 'sections')
      .where('lesson.subjectId IN (:...subjectIds)', { subjectIds })
      .orderBy('RAND()')
      .take(limit)
      .getMany();
  }

  /** `fetch=all` for an enrolled user: every lesson across their enrolled subjects, in stable
   * subject/topic/level order rather than RAND() — this is a "give me the whole set" query
   * (e.g. a progress dashboard), not a discovery sample, so shuffling would just make paging and
   * caching on the frontend harder for no benefit. */
  private getLessonsBySubjects(subjectIds: number[], limit: number) {
    return this.lessonRepository
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.subject', 'subject')
      .leftJoinAndSelect('lesson.topic', 'topic')
      .leftJoinAndSelect('lesson.user', 'user')
      .leftJoinAndSelect('lesson.sections', 'sections')
      .where('lesson.subjectId IN (:...subjectIds)', { subjectIds })
      .orderBy('lesson.subjectId', 'ASC')
      .addOrderBy('lesson.topicId', 'ASC')
      .addOrderBy('lesson.level', 'ASC')
      .addOrderBy('lesson.id', 'ASC')
      .take(limit)
      .getMany();
  }
}
