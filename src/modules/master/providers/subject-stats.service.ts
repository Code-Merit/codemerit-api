import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';
import { Certificate } from 'src/common/typeorm/entities/certificate.entity';
import { CertificationTrack } from 'src/common/typeorm/entities/certification-track.entity';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { SubjectTrack } from 'src/common/typeorm/entities/subject-track.entity';
import { SkillRating } from 'src/common/typeorm/entities/skill-rating.entity';
import { EnrollmentStatusEnum } from 'src/common/enum/enrollment-status.enum';
import { RatingTypeEnum } from 'src/common/enum/rating-type.enum';
import { SkillTypeEnum } from 'src/common/enum/skill-type.enum';
import { computeAttemptMetrics, getAggregateUserLevel } from 'src/common/utils/common-functions';
import { DataSource, In, Repository } from 'typeorm';
import { MeritService } from './merit.service';
import { TopicAnalysisService } from './topic-analysis.service';
import { SubjectTrackAnalysisService } from './subject-track-analysis.service';
import { BadgeQueryService } from '../../achievement/providers/badge-query.service';

@Injectable()
export class SubjectStatsService {
  constructor(
    @InjectRepository(JobRoleSubject)
    private readonly jobRoleSubjectRepo: Repository<JobRoleSubject>,

    @InjectRepository(SubjectTrack)
    private readonly subjectTrackRepo: Repository<SubjectTrack>,

    private readonly dataSource: DataSource,
    private readonly topicAnalyzer: TopicAnalysisService,
    private readonly meritService: MeritService,
    private readonly subjectTrackAnalyzer: SubjectTrackAnalysisService,
    private readonly badgeQueryService: BadgeQueryService,
  ) {}

  // ─── Subject Track Counts ─────────────────────────────────────────────────────

  async getSubjectTrackCounts(): Promise<Map<number, number>> {
    const rows = await this.subjectTrackRepo
      .createQueryBuilder('st')
      .select('st.subjectId', 'subjectId')
      .addSelect('COUNT(st.id)', 'count')
      .groupBy('st.subjectId')
      .getRawMany();
    return new Map(rows.map((r) => [+r.subjectId, +r.count]));
  }

  // ─── Core Subject Stats Query ─────────────────────────────────────────────────

  private async getSubjectStats(subjectId?: number, userId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('s.id', 'subjectId')
      .addSelect('s.title', 'title')
      .addSelect('s.description', 'description')
      .addSelect('s.image', 'image')
      .addSelect('s.slug', 'slug')
      .addSelect('s.color', 'color')
      .addSelect('s.isPublished', 'isPublished')
      .addSelect('COUNT(DISTINCT CASE WHEN q.status = :active THEN q.id END)', 'numQuestions')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :questionType THEN q.id END)',
        'numTrivia',
      )
      .addSelect('COUNT(DISTINCT CASE WHEN q.status = :active AND q.level = :easy THEN q.id END)', 'numEasyTrivia')
      .addSelect('COUNT(DISTINCT CASE WHEN q.status = :active AND q.level = :medium THEN q.id END)', 'numIntTrivia')
      .addSelect('COUNT(DISTINCT CASE WHEN q.status = :active AND q.level = :hard THEN q.id END)', 'numAdvTrivia')
      // SME-only breakdown (see getAllSubjects' `isSme` param) — type-and-level scoped, unlike
      // numEasyTrivia/numIntTrivia/numAdvTrivia above (which count every type at that level, not
      // just Trivia, despite the name — left as-is since other consumers may already depend on
      // that shape; these new columns are correctly scoped from the start).
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :general THEN q.id END)',
        'numGeneral',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :questionType AND q.level = :easy THEN q.id END)',
        'numTriviaEasy',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :questionType AND q.level = :medium THEN q.id END)',
        'numTriviaIntermediate',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :questionType AND q.level = :hard THEN q.id END)',
        'numTriviaAdvanced',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :general AND q.level = :easy THEN q.id END)',
        'numGeneralEasy',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :general AND q.level = :medium THEN q.id END)',
        'numGeneralIntermediate',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN q.status = :active AND q.questionType = :general AND q.level = :hard THEN q.id END)',
        'numGeneralAdvanced',
      )
      .from(Subject, 's')
      .where('s.isPublished = :isPublished', { isPublished: 1 })
      .leftJoin('question', 'q', 'q.subjectId = s.id')
      .setParameter('questionType', QuestionTypeEnum.Trivia)
      .setParameter('general', QuestionTypeEnum.General)
      .setParameter('active', QuestionStatusEnum.Active)
      .setParameter('easy', DifficultyLevelEnum.Easy)
      .setParameter('medium', DifficultyLevelEnum.Intermediate)
      .setParameter('hard', DifficultyLevelEnum.Advanced)
      .groupBy('s.id');

    if (subjectId) qb.where('s.id = :subjectId', { subjectId });

    if (userId) {
      const latestAttemptSub = this.dataSource
        .createQueryBuilder()
        .subQuery()
        .select('qa2.questionId', 'questionId')
        .addSelect('MAX(qa2.id)', 'maxId')
        .from(QuestionAttempt, 'qa2')
        .where('qa2.userId = :userId', { userId })
        .groupBy('qa2.questionId')
        .getQuery();

      qb.leftJoin(`(${latestAttemptSub})`, 'la', 'la.questionId = q.id')
        .leftJoin('question_attempt', 'qa', 'qa.id = la.maxId')
        .addSelect('COUNT(DISTINCT qa.questionId)', 'attempted')
        .addSelect('SUM(CASE WHEN q.level = :easy AND qa.id IS NOT NULL THEN 1 ELSE 0 END)', 'attemptedEasy')
        .addSelect('SUM(CASE WHEN q.level = :medium AND qa.id IS NOT NULL THEN 1 ELSE 0 END)', 'attemptedMedium')
        .addSelect('SUM(CASE WHEN q.level = :hard AND qa.id IS NOT NULL THEN 1 ELSE 0 END)', 'attemptedHard')
        .addSelect('SUM(CASE WHEN qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correct')
        .addSelect('SUM(CASE WHEN q.level = :easy AND qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correctEasy')
        .addSelect('SUM(CASE WHEN q.level = :medium AND qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correctMedium')
        .addSelect('SUM(CASE WHEN q.level = :hard AND qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correctHard')
        .addSelect(
          'SUM(CASE WHEN qa.isCorrect = 0 AND qa.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
          'wrong',
        )
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
        )
        .addSelect('SUM(CASE WHEN qa.isSkipped = 1 THEN 1 ELSE 0 END)', 'skipped')
        // isSubscribed = "has a SkillEnrollment here that isn't explicitly cancelled" —
        // deliberately not status='active'/not-expired: a naturally expired paid tier
        // still counts as "my subjects" for personalization purposes, same as before
        // UserSubject existed. Real access checks (quiz/lesson gating) are a separate,
        // stricter query in SkillEnrollmentService and are unaffected by this.
        .addSelect('CASE WHEN se.userId IS NOT NULL THEN 1 ELSE 0 END', 'isSubscribed')
        .leftJoin(
          'skill_enrollment', 'se',
          'se.subjectId = s.id AND se.userId = :userId AND se.status != :cancelledStatus',
          { userId, cancelledStatus: EnrollmentStatusEnum.Cancelled },
        )
        .setParameter('userId', userId);

      // "Journey" totals — every attempt ever, retries included — separate from the
      // latest-attempt-only fields above. See TopicAnalysisService for the same split;
      // this is the subject-level equivalent so journeyAccuracy is available everywhere.
      qb.leftJoin(
        (subQ) => {
          return subQ
            .select('qa3.questionId', 'questionId')
            .addSelect('COUNT(*)', 'attempts')
            .addSelect('SUM(CASE WHEN qa3.isCorrect = 1 THEN 1 ELSE 0 END)', 'correct')
            .addSelect(
              'SUM(CASE WHEN qa3.isCorrect = 0 AND qa3.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
              'wrong',
            )
            .from('question_attempt', 'qa3')
            .where('qa3.userId = :userId', { userId })
            .groupBy('qa3.questionId');
        },
        'rawAttempts',
        'rawAttempts.questionId = q.id',
      )
        .addSelect('COALESCE(SUM(rawAttempts.attempts), 0)', 'journeyAttempts')
        .addSelect('COALESCE(SUM(rawAttempts.correct), 0)', 'journeyCorrect')
        .addSelect('COALESCE(SUM(rawAttempts.wrong), 0)', 'journeyWrong');
    } else {
      qb.addSelect('0', 'attempted')
        .addSelect('0', 'correct')
        .addSelect('0', 'wrong')
        .addSelect('0', 'skipped')
        .addSelect('false', 'isSubscribed')
        .addSelect('0', 'journeyAttempts')
        .addSelect('0', 'journeyCorrect')
        .addSelect('0', 'journeyWrong');
    }

    if (subjectId) return qb.getRawOne();
    return qb.getRawMany();
  }

  /** Public accessor returning a Map keyed by subjectId — used by ProgramService. */
  async getSubjectStatsMap(userId?: number): Promise<Map<number, any>> {
    const rows = (await this.getSubjectStats(undefined, userId)) as any[];
    return new Map(rows.map((r) => [+r.subjectId, r]));
  }

  // ─── All Subjects (master list) ───────────────────────────────────────────────

  /**
   * `isSme` gates the `questionBreakdown` field on each subject — trivia/general question
   * counts split by difficulty level. Content-authoring detail that's only meaningful to
   * someone who writes/reviews questions, so it's kept off the response entirely for
   * everyone else rather than shipped-but-unused.
   */
  async getAllSubjects(userId?: number, isSme = false) {
    const [rows, trackCounts] = await Promise.all([
      this.getSubjectStats(undefined, userId),
      this.getSubjectTrackCounts(),
    ]);
    return (rows as any[]).map((r) => {
      const subject: any = {
        id: +r.subjectId,
        title: r.title,
        description: r.description,
        image: r.image,
        slug: r.slug,
        isPublished: r.isPublished,
        color: r.color,
        numQuestions: +r.numQuestions || 0,
        numTrivia: +r.numTrivia || 0,
        isSubscribed: r.isSubscribed === 1 || r.isSubscribed === '1',
        subjectTrackCount: trackCounts.get(+r.subjectId) ?? 0,
      };
      if (isSme) {
        subject.questionBreakdown = {
          trivia: {
            total: +r.numTrivia || 0,
            easy: +r.numTriviaEasy || 0,
            intermediate: +r.numTriviaIntermediate || 0,
            advanced: +r.numTriviaAdvanced || 0,
          },
          general: {
            total: +r.numGeneral || 0,
            easy: +r.numGeneralEasy || 0,
            intermediate: +r.numGeneralIntermediate || 0,
            advanced: +r.numGeneralAdvanced || 0,
          },
        };
      }
      return subject;
    });
  }

  // ─── Single Subject Page ──────────────────────────────────────────────────────

  async getSubjectPage(slug: string, userId?: number) {
    const subject = await this.dataSource
      .getRepository(Subject)
      .findOne({ where: { slug }, select: ['id'] });
    if (!subject) throw new NotFoundException('Subject not found');

    const subjectId = subject.id;

    const [raw, syllabus, subjectMerits, popularTopicsMap, ratings, lessons, relatedJobRoles, badges] = await Promise.all([
      this.getSubjectStats(subjectId, userId),
      this.topicAnalyzer.getTopicStatsBySubject(subjectId, userId),
      this.meritService.getSubjectMasteryLeaderboards([subjectId], userId),
      this.meritService.getPopularTopicsBySubject([subjectId]),
      userId ? this.getSubjectRatings(subjectId, userId) : Promise.resolve([]),
      this.getSubjectLessons(subjectId, userId),
      this.getRelatedJobRoles(subjectId),
      this.badgeQueryService.getUserBadgesForScope(BadgeScopeEnum.SUBJECT, subjectId, userId),
    ]);

    if (!raw) return null;

    // Reuse the per-topic stats already computed for `syllabus` — avoids a second
    // grouped join over question_topic/question for the same topic set.
    const topicStatsMap = new Map<number, any>(syllabus.map((t: any) => [t.id, t]));
    const subjectTracks = await this.subjectTrackAnalyzer.getSubjectTracksBySubject(
      subjectId,
      topicStatsMap,
      userId,
    );
    const subjectTrackMap = new Map<number, any>(subjectTracks.map((st: any) => [st.id, st]));
    const certificationTracks = await this.getCertificationTracksForSubject(
      subjectId,
      subjectTrackMap,
      userId,
    );
    // null until every topic in the subject has a SELF rating on file — the Overview tab's
    // "Self Rate Your Skills" widget shows a plain CTA while this is null, and a summary once
    // it isn't. Reuses the same topic-id universe `syllabus` already computed above.
    const detailSelfRating = userId
      ? await this.getDetailSelfRating(subjectId, userId, syllabus)
      : null;

    const attempted = +raw.attempted || 0;
    const correct = +raw.correct || 0;
    const wrong = +raw.wrong || 0;
    const skipped = +raw.skipped || 0;
    const numTrivia = +raw.numTrivia || 0;
    const journeyAttempts = +raw.journeyAttempts || 0;
    const journeyCorrect = +raw.journeyCorrect || 0;
    const journeyWrong = +raw.journeyWrong || 0;
    // computeAttemptMetrics() is the one shared implementation of this formula —
    // every level (subject/topic/subjectTrack) calls it instead of reimplementing it.
    const { coverage, correctCoverage, currentAccuracy, score, journeyAccuracy, journeyScore } = computeAttemptMetrics({
      numTrivia, attempted, correct, wrong, journeyAttempts, journeyCorrect, journeyWrong,
    });

    return {
      id: +raw.subjectId,
      title: raw.title,
      description: raw.description,
      image: raw.image,
      slug: raw.slug,
      color: raw.color,
      isPublished: raw.isPublished,
      numQuestions: +raw.numQuestions || 0,
      numTrivia,
      numEasyTrivia: +raw.numEasyTrivia || 0,
      numIntTrivia: +raw.numIntTrivia || 0,
      numAdvTrivia: +raw.numAdvTrivia || 0,
      isSubscribed: raw.isSubscribed === 1 || raw.isSubscribed === '1',
      attempted,
      attemptedEasy: +raw.attemptedEasy || 0,
      attemptedMedium: +raw.attemptedMedium || 0,
      attemptedHard: +raw.attemptedHard || 0,
      correct,
      correctEasy: +raw.correctEasy || 0,
      correctMedium: +raw.correctMedium || 0,
      correctHard: +raw.correctHard || 0,
      wrong,
      wrongEasy: +raw.wrongEasy || 0,
      wrongMedium: +raw.wrongMedium || 0,
      wrongHard: +raw.wrongHard || 0,
      userLevel: getAggregateUserLevel(
        +raw.attemptedEasy || 0, +raw.correctEasy || 0,
        +raw.attemptedMedium || 0, +raw.correctMedium || 0,
        +raw.attemptedHard || 0, +raw.correctHard || 0,
        correctCoverage,
      ),
      skipped,
      currentAccuracy,
      coverage,
      score,
      journeyAttempts,
      journeyCorrect,
      journeyWrong,
      journeyAccuracy,
      journeyScore,
      userRank: subjectMerits.userRanks.get(subjectId) ?? null,
      subjectTracks,
      certificationTracks,
      lessons,
      nextAction: this.computeNextAction(syllabus, lessons.list, subjectTracks, certificationTracks),
      relatedJobRoles,
      meritList: subjectMerits.meritLists.get(subjectId) ?? [],
      popularTopics: popularTopicsMap.get(subjectId) ?? [],
      subjectRatings: ratings,
      // Badges scoped to this subject, each tagged `unlocked` — omitted (empty array) for
      // anonymous requests, same as `subjectRatings` above.
      badges,
      detailSelfRating,
    };
  }

  // ─── Next Best Action ──────────────────────────────────────────────────────────

  /**
   * Single backend-computed "what should this learner do next" suggestion for the
   * subject dashboard hero widget. Priority: resume an in-progress lesson (anywhere
   * in the subject) > finish unread/incomplete lessons on the earliest unmastered
   * topic (walked in `syllabus`'s `t.order` sequence) > quiz that exact topic once
   * its lessons are done > nudge toward the nearest incomplete certification once
   * every topic is mastered > caught up.
   *
   * No userId branching needed: for anonymous callers every lesson's `status` is
   * null and every topic's quiz stats are zero, so the walk below naturally lands
   * on "first topic, first lesson (or quiz if it has none)" instead of a
   * personalized resume — still a sensible suggestion, just not personalized.
   */
  private computeNextAction(
    syllabus: any[],
    lessonsList: any[],
    subjectTracks: any[],
    certificationTracks: any[],
  ): any {
    const inProgress = lessonsList.filter(
      (l) => l.status === UserLessonTrackerStatusEnum.Read && l.lastActivityAt,
    );
    if (inProgress.length) {
      const latest = inProgress.reduce((a, b) =>
        new Date(a.lastActivityAt).getTime() >= new Date(b.lastActivityAt).getTime() ? a : b,
      );
      return {
        type: 'resume-lesson',
        lessonId: latest.id,
        title: latest.title,
        slug: latest.slug,
        topicId: latest.topicId,
        topicTitle: latest.topicTitle,
        progressPercent: latest.progressPercent,
      };
    }

    const lessonsByTopic = new Map<number, any[]>();
    for (const l of lessonsList) {
      if (!l.topicId) continue;
      const arr = lessonsByTopic.get(l.topicId) ?? [];
      arr.push(l);
      lessonsByTopic.set(l.topicId, arr);
    }

    for (const topic of syllabus) {
      const topicLessons = lessonsByTopic.get(topic.id) ?? [];
      const lessonsTotal = topicLessons.length;
      const lessonsCompleted = topicLessons.filter(
        (l) => l.status === UserLessonTrackerStatusEnum.Completed,
      ).length;
      const lessonsDone = lessonsTotal === 0 || lessonsCompleted === lessonsTotal;

      if (lessonsDone && topic.isCompleted) continue; // fully mastered — move to next topic

      if (!lessonsDone) {
        const nextLesson = topicLessons.find(
          (l) => l.status !== UserLessonTrackerStatusEnum.Completed,
        );
        return {
          type: 'learn-lesson',
          topicId: topic.id,
          topicTitle: topic.title,
          lessonId: nextLesson?.id ?? null,
          lessonTitle: nextLesson?.title ?? null,
          lessonSlug: nextLesson?.slug ?? null,
          lessonsCompleted,
          lessonsTotal,
        };
      }

      // Lessons done (or topic has none) but the quiz isn't — target this exact topic.
      const track = subjectTracks.find((st) => st.topics?.some((t: any) => t.id === topic.id));
      return {
        type: 'quiz',
        topicId: topic.id,
        topicTitle: topic.title,
        subjectTrackId: track?.id ?? null,
        subjectTrackTitle: track?.title ?? null,
        score: topic.score,
        currentAccuracy: topic.currentAccuracy,
        coverage: topic.coverage,
      };
    }

    // Every topic mastered — nudge toward the nearest incomplete certification. Cert cards
    // (from getCertificationTracksForSubject below) don't carry a top-level progress/achieved
    // flag of their own — only per-subjectTrack progressPercent/isCompleted and myCertificate
    // (set only once a Certificate row actually exists) — so derive both here rather than
    // assuming fields that were never computed for this endpoint.
    const certCandidates = certificationTracks
      .filter((ct) => !ct.myCertificate)
      .map((ct) => {
        const total = ct.totalSubjectTracks || ct.subjectTracks?.length || 0;
        const completed = (ct.subjectTracks ?? []).filter((st: any) => st.isCompleted).length;
        return { ct, progressPercent: total > 0 ? +((completed / total) * 100).toFixed(0) : 0 };
      })
      .sort((a, b) => b.progressPercent - a.progressPercent);

    if (certCandidates.length) {
      const best = certCandidates[0];
      return {
        type: 'certification',
        certificationTrackId: best.ct.id,
        title: best.ct.title,
        progressPercent: best.progressPercent,
      };
    }
    return { type: 'caught-up' };
  }

  // ─── Certification Tracks (subject-native only) ────────────────────────────────

  // "Belongs to this subject" is defined exactly the way CertificationTrack.subjectId's own
  // doc comment intends and the way CertificateService.getExplorer's Subject-group already
  // works: ct.subjectId = this subject, full stop. Previously this joined through
  // certification_track_subject_track and pulled in ANY job-role-bundle track that merely
  // required one of this subject's tracks as an ingredient (e.g. every "Full Stack Developer"
  // style bundle needing some JavaScript) — that's how JavaScript's Certificate tab ballooned
  // to 25 tracks when it should show exactly its own 3 (Foundation/Intermediate/Developer).
  private async getCertificationTracksForSubject(
    subjectId: number,
    subjectTrackMap: Map<number, any>,
    userId?: number,
  ) {
    const nativeTracks = await this.dataSource
      .getRepository(CertificationTrack)
      .find({ where: { subjectId, isPublished: true } });
    if (!nativeTracks.length) return [];

    const ctIds = nativeTracks.map((t) => t.id);

    // Still resolved for display (e.g. "Certified via the React Developer role") even though
    // job roles no longer decide whether a track shows up here at all.
    const [stRows, jobRoleRows, myCertificates] = await Promise.all([
      this.dataSource
        .createQueryBuilder()
        .select('ctst.certificationTrackId', 'ctId')
        .addSelect('ctst.subjectTrackId', 'stId')
        .from('certification_track_subject_track', 'ctst')
        .where('ctst.certificationTrackId IN (:...ctIds)', { ctIds })
        .getRawMany(),
      this.dataSource
        .createQueryBuilder()
        .select('ctjr.certificationTrackId', 'ctId')
        .addSelect('jr.id', 'jrId')
        .addSelect('jr.title', 'jrTitle')
        .from('certification_track_job_role', 'ctjr')
        .innerJoin('job_role', 'jr', 'jr.id = ctjr.jobRoleId AND jr.isPublished = 1')
        .where('ctjr.certificationTrackId IN (:...ctIds)', { ctIds })
        .andWhere('ctjr.isPublished = 1')
        .getRawMany(),
      userId
        ? this.dataSource
            .getRepository(Certificate)
            .find({ where: { userId, certificationTrackId: In(ctIds) } })
        : Promise.resolve([]),
    ]);

    const stIdsByCt = new Map<number, Set<number>>();
    for (const row of stRows) {
      const ctId = +row.ctId;
      const set = stIdsByCt.get(ctId) ?? new Set<number>();
      set.add(+row.stId);
      stIdsByCt.set(ctId, set);
    }
    const roleTitlesByCt = new Map<number, Map<number, string>>();
    for (const row of jobRoleRows) {
      const ctId = +row.ctId;
      const roles = roleTitlesByCt.get(ctId) ?? new Map<number, string>();
      roles.set(+row.jrId, row.jrTitle);
      roleTitlesByCt.set(ctId, roles);
    }
    const certMap = new Map<number, Certificate>(myCertificates.map((c) => [c.certificationTrackId, c]));

    return [...nativeTracks]
      .sort((a, b) => a.id - b.id) // no dedicated sortOrder on subject-native tracks; id order matches authoring order (Foundation -> Intermediate -> Developer)
      .map((track) => {
        const subjectTracks = [...(stIdsByCt.get(track.id) ?? [])]
          .map((id) => subjectTrackMap.get(id))
          .filter(Boolean)
          .map((st: any) => ({
            id: st.id, title: st.title, slug: st.slug, totalTopics: st.totalTopics,
            progressPercent: st.progressPercent, score: st.score, isCompleted: st.isCompleted,
            attemptedEasy: st.attemptedEasy, attemptedMedium: st.attemptedMedium, attemptedHard: st.attemptedHard,
            correctEasy: st.correctEasy, correctMedium: st.correctMedium, correctHard: st.correctHard,
            wrongEasy: st.wrongEasy, wrongMedium: st.wrongMedium, wrongHard: st.wrongHard,
            userLevel: st.userLevel,
            // Same fields certificate.service.ts's explorer reads off this identical
            // subjectTrackMap entry — kept consistent across both producers of this shape.
            totalQuestions: st.numTrivia ?? 0,
            attempted: st.attempted ?? 0,
            correct: st.correct ?? 0,
          }));

        const roleTitles = roleTitlesByCt.get(track.id);
        const card: any = {
          id: track.id,
          title: track.title,
          description: track.description,
          sortOrder: track.id,
          totalSubjectTracks: subjectTracks.length,
          subjectTracks,
          // Matches DisplayCertificationTrack's roleTitles contract (certification-tracks
          // component + Browse Certificates explorer) — undefined, not [], when there's no
          // published job role at all, so the template's @if stays clean.
          roleTitles: roleTitles?.size ? [...roleTitles.values()] : undefined,
        };

        if (userId) {
          const cert = certMap.get(track.id);
          card.myCertificate = cert
            ? {
                certificateNumber: cert.certificateNumber, status: cert.status,
                issuedAt: cert.issuedAt, pdfUrl: cert.pdfUrl,
              }
            : null;
        }

        return card;
      });
  }

  // ─── Lessons ────────────────────────────────────────────────────────────────

  private async getSubjectLessons(subjectId: number, userId?: number) {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('l.id', 'id')
      .addSelect('l.title', 'title')
      .addSelect('l.slug', 'slug')
      .addSelect('l.summary', 'summary')
      .addSelect('l.level', 'level')
      .addSelect('l.format', 'format')
      .addSelect('l.topicId', 'topicId')
      .addSelect('t.title', 'topicTitle')
      .addSelect('t.slug', 'topicSlug')
      .addSelect('COUNT(DISTINCT ls.id)', 'numSections')
      .from('lesson', 'l')
      .leftJoin('topic', 't', 't.id = l.topicId')
      .leftJoin('lesson_section', 'ls', 'ls.lessonId = l.id')
      .where('l.subjectId = :subjectId', { subjectId })
      .groupBy('l.id')
      .addGroupBy('t.id')
      .orderBy('t.order', 'ASC')
      .addOrderBy('l.id', 'ASC');

    if (userId) {
      qb.leftJoin('user_lesson_tracker', 'ult', 'ult.lessonId = l.id AND ult.userId = :userId', { userId })
        .addSelect('ult.status', 'status')
        .addSelect('ult.views', 'views')
        .addSelect('ult.progressPercent', 'progressPercent')
        .addSelect('ult.updatedAt', 'lastActivityAt')
        .addGroupBy('ult.id');
    }

    const rows = await qb.getRawMany();

    const list = rows.map((r) => ({
      id: +r.id,
      title: r.title,
      slug: r.slug,
      summary: r.summary ?? null,
      level: +r.level,
      format: r.format,
      topicId: r.topicId ? +r.topicId : null,
      topicTitle: r.topicTitle ?? null,
      topicSlug: r.topicSlug ?? null,
      numSections: +r.numSections || 0,
      status: userId ? (r.status ?? UserLessonTrackerStatusEnum.Pending) : null,
      views: userId ? +r.views || 0 : 0,
      progressPercent: userId ? (+r.progressPercent || 0) : 0,
      lastActivityAt: userId ? (r.lastActivityAt ?? null) : null,
    }));

    const completed = userId
      ? list.filter((l) => l.status === UserLessonTrackerStatusEnum.Completed).length
      : 0;
    const inProgress = userId
      ? list.filter((l) => l.status === UserLessonTrackerStatusEnum.Read).length
      : 0;
    const totalViews = userId ? list.reduce((sum, l) => sum + l.views, 0) : 0;
    const lastActivityAt = userId
      ? list.reduce<string | null>((latest, l) => {
          if (!l.lastActivityAt) return latest;
          if (!latest || new Date(l.lastActivityAt).getTime() > new Date(latest).getTime()) return l.lastActivityAt;
          return latest;
        }, null)
      : null;

    // Same numerator/denominator*100, .toFixed(1) convention computeAttemptMetrics() uses for
    // question coverage — kept inline here since it's a single field, not shared across levels.
    const learningCompleteness = list.length > 0 ? +((completed / list.length) * 100).toFixed(1) : 0;

    return { total: list.length, completed, inProgress, totalViews, lastActivityAt, learningCompleteness, list };
  }

  // ─── Related Job Roles ────────────────────────────────────────────────────────

  private async getRelatedJobRoles(subjectId: number) {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('jr.id', 'id')
      .addSelect('jr.title', 'title')
      .addSelect('jr.slug', 'slug')
      .addSelect('jr.image', 'image')
      .addSelect('jr.color', 'color')
      .addSelect('jrs.tag', 'tag')
      .from('job_role_subject', 'jrs')
      .innerJoin('job_role', 'jr', 'jr.id = jrs.jobRoleId AND jr.isPublished = 1')
      .where('jrs.subjectId = :subjectId', { subjectId })
      .orderBy('jrs.sortOrder', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      id: +r.id, title: r.title, slug: r.slug, image: r.image, color: r.color, tag: r.tag,
    }));
  }

  // ─── Assessment Ratings ───────────────────────────────────────────────────────

  async getSubjectRatings(subjectId: number, userId: number) {
    const sessions = await this.dataSource
      .getRepository(AssessmentSession)
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.skillRatings', 'rating')
      .leftJoinAndSelect('session.rater', 'rater')
      .where('session.userId = :userId', { userId })
      .andWhere('rating.skillId = :subjectId', { subjectId })
      .orderBy('session.id', 'DESC')
      .addOrderBy('rating.id', 'DESC')
      .getMany();

    return sessions.map((session) => ({
      id: session.id,
      assessmentTitle: session.assessmentTitle,
      createdAt: session.createdAt,
      ratingType: session.ratingType,
      ratedByName: session.rater
        ? `${session.rater.firstName ?? ''} ${session.rater.lastName ?? ''}`.trim()
        : null,
      skillRatings: session.skillRatings?.map((r) => ({
        id: r.id,
        skillId: r.skillId,
        skillType: r.skillType,
        rating: r.rating,
        createdAt: r.createdAt,
      })),
    }));
  }

  // Powers the Overview tab's "Self Rate Your Skills" widget. Deliberately all-or-nothing —
  // returns null the moment even one topic in the subject is missing a SELF rating, so the
  // widget has exactly two states (CTA vs. summary) instead of a partial-progress display.
  // `topics` is the same topic-id universe getSubjectPage already computed as `syllabus`, so
  // this needs no query of its own for "what topics does this subject have."
  private async getDetailSelfRating(
    subjectId: number,
    userId: number,
    topics: { id: number }[],
  ): Promise<{ totalTopics: number; averageRating: number; lastRatedAt: Date } | null> {
    const topicIds = topics.map((t) => t.id);
    if (!topicIds.length) return null;

    const ratings = await this.dataSource
      .getRepository(SkillRating)
      .createQueryBuilder('rating')
      .innerJoin('rating.assessmentSession', 'session')
      .where('session.userId = :userId', { userId })
      .andWhere('rating.skillType = :skillType', { skillType: SkillTypeEnum.TOPIC })
      .andWhere('rating.ratingType = :ratingType', { ratingType: RatingTypeEnum.SELF })
      .andWhere('rating.skillId IN (:...topicIds)', { topicIds })
      .orderBy('rating.skillId', 'ASC')
      .addOrderBy('rating.createdAt', 'DESC')
      .getMany();

    // A topic can carry more than one SELF rating over time (reassessment) — keep only the
    // most recent per topic, same "latest wins" rule the rest of this service applies to
    // repeated attempts elsewhere.
    const latestByTopic = new Map<number, SkillRating>();
    for (const r of ratings) {
      if (!latestByTopic.has(r.skillId)) latestByTopic.set(r.skillId, r);
    }
    if (latestByTopic.size < topicIds.length) return null;

    const latest = [...latestByTopic.values()];
    const averageRating = latest.reduce((sum, r) => sum + r.rating, 0) / latest.length;
    const lastRatedAt = latest.reduce(
      (max, r) => (r.createdAt > max ? r.createdAt : max),
      latest[0].createdAt,
    );

    return {
      totalTopics: topicIds.length,
      averageRating: Math.round(averageRating * 10) / 10,
      lastRatedAt,
    };
  }
}
