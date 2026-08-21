import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionTypeEnum } from 'src/common/enum/question-type.enum';
import { JobRoleSubject } from 'src/common/typeorm/entities/job-role-subject.entity';
import { QuestionAttempt } from 'src/common/typeorm/entities/question-attempt.entity';
import { Subject } from 'src/common/typeorm/entities/subject.entity';
import { Topic } from 'src/common/typeorm/entities/topic.entity';
import { computeAttemptMetrics } from 'src/common/utils/common-functions';
import { DataSource, Repository } from 'typeorm';
import { TopicAnalysisService } from './topic-analysis.service';
import { QuestionStatusEnum } from 'src/common/enum/question-status.enum';
import { DifficultyLevelEnum } from 'src/common/enum/difficulty-lavel.enum';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { EnrollmentStatusEnum } from 'src/common/enum/enrollment-status.enum';

// This service's only live entry point (reachable from outside this file) is
// getJobSubjectDashboards(), consumed by auth.service.ts (login response) and
// user-profile-aggregator.service.ts (profile page) — both always call it with
// fullData=false. Everything below follows from that: getPopularTopics is reachable
// only via fullData=true, which nothing currently passes. Two other methods that
// used to live here — getSubjectRatings (a subjectId-filter-ignoring duplicate of
// SubjectStatsService.getSubjectRatings()) and getMeritList (a duplicate of
// MeritService's old subject-merit formula) — were deleted rather than fixed for
// the same reason: they were unreachable, so fixing them would just relocate the
// duplication-drift risk. A substantial amount of genuinely dead code (a duplicate, unfixed
// getCareerDashboard/topic-completion pipeline, an OLD job-subject-dashboards method,
// and several unused list/lookup methods) was removed here rather than "fixed",
// since fixing unreachable code just relocates the duplication-drift risk rather
// than removing it — see Auto-Certification-and-Gamification-Layer.md for details.
@Injectable()
export class SubjectAnalysisService {
  constructor(
    @InjectRepository(JobRoleSubject)
    private jobRoleSubjectRepo: Repository<JobRoleSubject>,

    @InjectRepository(UserJobRole)
    private userJobRoleRepo: Repository<UserJobRole>,

    private readonly dataSource: DataSource,
    private topicAnalyzer: TopicAnalysisService
  ) { }

  /**
   * Core query for subject stats.
   * - If subjectId provided -> returns one row (getRawOne).
   * - Else returns all subjects (getRawMany).
   *
   * Uses latest-attempt-per-question logic (subquery) when userId is provided,
   * so counts are per-question (not per-attempt row) — same methodology as
   * SubjectStatsService.getSubjectStats(), kept as a separate query here rather
   * than merged since this service returns a narrower shape and is on a
   * login-response hot path.
   */
  private async getSubjectStats(subjectId?: number, userId?: number) {
    const isPublished = 1;
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
        'numTrivia')
      .addSelect('COUNT(DISTINCT CASE WHEN q.status = :active AND q.level = :easy THEN q.id END)', 'numEasyTrivia')
      .addSelect('COUNT(DISTINCT CASE WHEN q.status = :active AND q.level = :medium THEN q.id END)', 'numIntTrivia')
      .addSelect('COUNT(DISTINCT CASE WHEN q.status = :active AND q.level = :hard THEN q.id END)', 'numAdvTrivia')
      .from(Subject, 's')
      .where('s.isPublished = :isPublished', { isPublished })
      .leftJoin('question', 'q', 'q.subjectId = s.id')
      .setParameter('questionType', QuestionTypeEnum.Trivia)
      .setParameter('active', QuestionStatusEnum.Active)
      .setParameter('easy', DifficultyLevelEnum.Easy)
      .setParameter('medium', DifficultyLevelEnum.Intermediate)
      .setParameter('hard', DifficultyLevelEnum.Advanced)
      .groupBy('s.id')

    if (subjectId) {
      qb.where('s.id = :subjectId', { subjectId });
    }

    if (userId) {
      // Subquery: latest attempt id per question for this user
      const latestAttemptSub = this.dataSource
        .createQueryBuilder()
        .subQuery()
        .select('qa2.questionId', 'questionId')
        .addSelect('MAX(qa2.id)', 'maxId')
        .from(QuestionAttempt, 'qa2')
        .where('qa2.userId = :userId', { userId })
        .groupBy('qa2.questionId')
        .getQuery();

      // join that subquery -> join the attempt rows (one per question)
      qb
        .leftJoin(`(${latestAttemptSub})`, 'la', 'la.questionId = q.id')
        .leftJoin('question_attempt', 'qa', 'qa.id = la.maxId')
        // attempted = number of distinct questions user has latest attempts for (one per question)
        .addSelect('COUNT(qa.id)', 'totalAttempted')
        .addSelect('COUNT(DISTINCT qa.questionId)', 'attempted')
        .addSelect(
          'SUM(CASE WHEN q.level = :easy AND qa.id IS NOT NULL THEN 1 ELSE 0 END)',
          'attemptedEasy'
        )
        .addSelect(
          'SUM(CASE WHEN q.level = :medium AND qa.id IS NOT NULL THEN 1 ELSE 0 END)',
          'attemptedMedium'
        )
        .addSelect(
          'SUM(CASE WHEN q.level = :hard AND qa.id IS NOT NULL THEN 1 ELSE 0 END)',
          'attemptedHard'
        )
        // correct/wrong/skipped computed from the latest attempt per question
        .addSelect('SUM(CASE WHEN qa.isCorrect = 1 THEN 1 ELSE 0 END)', 'correct')
        .addSelect(
          'SUM(CASE WHEN q.level = :easy AND qa.isCorrect = 1 THEN 1 ELSE 0 END)',
          'correctEasy'
        )
        .addSelect(
          'SUM(CASE WHEN q.level = :medium AND qa.isCorrect = 1 THEN 1 ELSE 0 END)',
          'correctMedium'
        )
        .addSelect(
          'SUM(CASE WHEN q.level = :hard AND qa.isCorrect = 1 THEN 1 ELSE 0 END)',
          'correctHard'
        )
        .addSelect(
          'SUM(CASE WHEN qa.isCorrect = 0 AND qa.selectedOption IS NOT NULL THEN 1 ELSE 0 END)',
          'wrong'
        )
        .addSelect('SUM(CASE WHEN qa.isSkipped = 1 THEN 1 ELSE 0 END)', 'skipped')
        // isSubscribed = "has a SkillEnrollment here that isn't explicitly cancelled" —
        // same semantics as SubjectStatsService/TopicAnalysisService (see those for why
        // not status='active'/not-expired). UserSubject, which this used to read, is retired.
        .addSelect('CASE WHEN se.userId IS NOT NULL THEN 1 ELSE 0 END', 'isSubscribed')
        .leftJoin(
          'skill_enrollment', 'se',
          'se.subjectId = s.id AND se.userId = :userId AND se.status != :cancelledStatus',
          { userId, cancelledStatus: EnrollmentStatusEnum.Cancelled },
        )
        .setParameter('userId', userId);

      // "Journey" totals — every attempt ever, retries included — same split as
      // SubjectStatsService/TopicAnalysisService, so this endpoint's numbers are
      // consistent with subjectDashboard's rather than a fourth silently-diverging copy.
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
      qb
        .addSelect('0', 'totalAttempted')
        .addSelect('0', 'attempted')
        .addSelect('0', 'correct')
        .addSelect('0', 'wrong')
        .addSelect('0', 'skipped')
        .addSelect('false', 'isSubscribed')
        .addSelect('0', 'journeyAttempts')
        .addSelect('0', 'journeyCorrect')
        .addSelect('0', 'journeyWrong');
    }

    if (subjectId) {
      return qb.getRawOne();
    }
    return qb.getRawMany();
  }

  /**
   * The central method — returns a subject dashboard object.
   * - fullData=true will include meritList & popularTopics (expensive)
   */
  async getSubjectDashboard(subjectId: number, userId?: number, fullData = false) {
    const row = await this.getSubjectStats(subjectId, userId);
    if (!row) return null;
    const attempted = +row.attempted || 0;
    const correct = +row.correct || 0;
    const wrong = +row.wrong || 0;
    const skipped = +row.skipped || 0;
    const numTrivia = +row.numTrivia || 0;

    const journeyAttempts = +row.journeyAttempts || 0;
    const journeyCorrect = +row.journeyCorrect || 0;
    const journeyWrong = +row.journeyWrong || 0;
    // computeAttemptMetrics() is the one shared implementation of this formula —
    // every level (subject/topic/subjectTrack) calls it instead of reimplementing it.
    const { coverage, currentAccuracy, score, journeyAccuracy, journeyScore } = computeAttemptMetrics({
      numTrivia, attempted, correct, wrong, journeyAttempts, journeyCorrect, journeyWrong,
    });

    const dashboard: any = {
      id: +row.subjectId,
      title: row.title,
      description: row.description,
      image: row.image,
      slug: row.slug,
      isPublished: row.isPublished,
      color: row.color,
      numQuestions: +row.numQuestions || 0,
      numTrivia,
      numEasyTrivia: row.numEasyTrivia,
      numIntTrivia: row.numIntTrivia,
      numAdvTrivia: row.numAdvTrivia,
      isSubscribed: row.isSubscribed === 1 || row.isSubscribed === '1',
      attempted,
      attemptedEasy: row.attemptedEasy,
      attemptedMedium: row.attemptedMedium,
      attemptedHard: row.attemptedHard,
      correct,
      correctEasy : row.correctEasy,
      correctMedium : row.correctMedium,
      correctHard : row.correctHard,
      wrong,
      skipped,
      currentAccuracy,
      coverage,
      score,
      journeyAttempts,
      journeyCorrect,
      journeyWrong,
      journeyAccuracy,
      journeyScore,
      syllabus: [],
      meritList: [],
      popularTopics: [],
      subjectRatings: []
    };

    if (fullData) {
      // Subject ratings for the full-data view are served by
      // SubjectStatsService.getSubjectRatings() (see getSubjectPage) — this
      // service no longer duplicates that query. Merit list is likewise served
      // by MeritService.getSubjectMasteryLeaderboards() elsewhere — dashboard.meritList
      // stays [] here since nothing in this dead (fullData=false-always) branch needs it.
      [dashboard.syllabus, dashboard.popularTopics] = await Promise.all([
        this.topicAnalyzer.getTopicStatsBySubject(subjectId, userId),
        this.getPopularTopics(subjectId),
      ]);
    }

    return dashboard;
  }

  async getJobSubjectDashboards(userId: number, fullData = false) {
  // Step 1: Get all job roles for the user
  const userJobRoles = await this.userJobRoleRepo
    .createQueryBuilder('ujr')
    .select('ujr.jobRoleId', 'jobRoleId')
    .where('ujr.userId = :userId', { userId })
    .getRawMany();

  if (!userJobRoles.length) return [];

  const jobRoleIds = userJobRoles.map((r) => r.jobRoleId);

  // Step 2: Get subjects mapped to these job roles
  const roleSubjects = await this.jobRoleSubjectRepo
    .createQueryBuilder('jrs')
    .select('DISTINCT jrs.subjectId', 'subjectId')
    .where('jrs.jobRoleId IN (:...jobRoleIds)', { jobRoleIds })
    .getRawMany();

  if (!roleSubjects.length) return [];

  // Step 3: Fetch dashboards for unique subjects
  return Promise.all(
    roleSubjects.map((s) =>
      this.getSubjectDashboard(+s.subjectId, userId, fullData),
    ),
  );
}

  /** popular topics: unchanged */
  private async getPopularTopics(subjectId: number) {
    const topicsRaw = await this.dataSource
      .createQueryBuilder()
      .select('t.id', 'id')
      .addSelect('t.title', 'title')
      .addSelect('t.slug', 'slug')
      .addSelect('t.shortDesc', 'shortDesc')
      .addSelect('t.popularity', 'popularity')
      .from(Topic, 't')
      .where('t.subjectId = :subjectId', { subjectId })
      .orderBy('t.popularity', 'DESC')
      .limit(10)
      .getRawMany();

    return topicsRaw.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      shortDesc: t.shortDesc,
      popularity: +t.popularity,
    }));
  }


}
