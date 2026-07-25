import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { LessonSection } from 'src/common/typeorm/entities/lesson-section.entity';
import { Lesson } from 'src/common/typeorm/entities/lesson.entity';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { UserLessonTracker } from 'src/common/typeorm/entities/user-lesson-tracker.entity';
import { UserSubject } from 'src/common/typeorm/entities/user-subject.entity';
import {
  generateSlug,
  generateUniqueSlug,
} from 'src/common/utils/slugify.util';
import { DataSource, In, Repository } from 'typeorm';
import { CreateLessonDto } from '../dtos/create-lesson.dto';
import { GetLessonsDto } from '../dtos/get-lessons.dto';
import { UpdateLessonProgressDto } from '../dtos/update-lesson-progress.dto';

@Injectable()
export class LessonService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(UserLessonTracker)
    private readonly userLessonTrackerRepo: Repository<UserLessonTracker>,
    private readonly dataSource: DataSource,
  ) {}

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

    return lessons.map((lesson) =>
      this.toLessonSummaryDto(lesson, trackerMap.get(lesson.id)),
    );
  }

  private toLessonSummaryDto(lesson: Lesson, tracker?: UserLessonTracker) {
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
      sections: lesson.sections || [],
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

    return this.toLessonSummaryDto(lesson, myTracker);
  }

  /** Called when a user opens a lesson: creates the tracker on first view (status Pending,
   * views 1) or increments `views` on every view after that. Never touches status/progressPercent
   * — those only change through updateLessonProgress(), so "I opened it" and "I made progress on
   * it" stay two independently meaningful signals instead of one call trying to mean both. */
  async recordLessonAccess(userId: number, slug: string): Promise<any> {
    const lesson = await this.findLessonEntityOrThrow(slug);
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

  /** Union of subjects a user is enrolled in directly (UserSubject) and subjects that belong to any
   * job role they're enrolled in (UserJobRole -> JobRoleSubject) — a job-role enrollment implies
   * enrollment in every subject on that role's curriculum, so lessons for those subjects should show
   * up in the same feed. */
  private async getEnrolledSubjectIds(userId: number): Promise<number[]> {
    const [userSubjects, userJobRoles] = await Promise.all([
      this.dataSource.getRepository(UserSubject).find({ where: { userId } }),
      this.dataSource.getRepository(UserJobRole).find({ where: { userId } }),
    ]);

    const subjectIds = new Set<number>(userSubjects.map((item) => item.subjectId));

    const jobRoleIds = userJobRoles.map((item) => item.jobRoleId);
    if (jobRoleIds.length) {
      const jobRoleSubjects = await this.dataSource
        .getRepository(JobRoleSubject)
        .find({ where: { jobRoleId: In(jobRoleIds) } });
      jobRoleSubjects.forEach((item) => subjectIds.add(item.subjectId));
    }

    return Array.from(subjectIds);
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
