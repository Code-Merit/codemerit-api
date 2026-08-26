import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RatingTypeEnum } from 'src/common/enum/rating-type.enum';
import { AssessmentSession } from 'src/common/typeorm/entities/assessment-session.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { UserStreak } from 'src/common/typeorm/entities/user-streak.entity';
import { ApiUsageService } from 'src/common/services/api-usage.service';
import { SubjectAnalysisService } from 'src/modules/master/providers/subject-analysis.service';
import { UserPermissionService } from 'src/modules/user-permission/providers/user-permission.service';
import { AchievementService } from 'src/modules/achievement/providers/achievement.service';
import { BadgeQueryService } from 'src/modules/achievement/providers/badge-query.service';
import { BadgeScopeEnum } from 'src/common/enum/badge-scope.enum';
import { computeLevel } from 'src/modules/achievement/constants/gamification.constants';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import { UserService } from './user.service';

// Who's asking — drives the PII gate below. Anonymous callers never reach getFullProfile at all
// (see getPublicProfile / users.controller.ts's separate, unguarded route for that case); this
// type only needs to distinguish the profile owner and an Admin from everyone else who can
// still legally load this page (e.g. today's Admin+Manager route guard on /users/view/:userName).
export interface ProfileViewer {
  id: number;
  role: string;
}

@Injectable()
export class UserProfileAggregatorService {
  private readonly logger = new Logger(UserProfileAggregatorService.name);

  constructor(
    private readonly userService: UserService,
    private readonly userPermissionService: UserPermissionService,
    private readonly subjectAnalysisService: SubjectAnalysisService,
    private readonly apiUsageService: ApiUsageService,
    private readonly achievementService: AchievementService,
    private readonly badgeQueryService: BadgeQueryService,
    private readonly activityService: ActivityService,
    @InjectRepository(UserStreak)
    private readonly userStreakRepository: Repository<UserStreak>,
    private readonly dataSource: DataSource,
  ) {}

  // Job-role-derived subjects (getJobSubjectDashboards) and directly-enrolled subjects
  // (getEnrolledSubjectDashboards) can legitimately overlap — union by subject id rather than
  // concatenating, so a subject reachable both ways only ever shows once.
  private async getCourseStats(userId: number) {
    const [byJobRole, byEnrollment] = await Promise.all([
      this.subjectAnalysisService.getJobSubjectDashboards(userId, false),
      this.subjectAnalysisService.getEnrolledSubjectDashboards(userId, false),
    ]);
    const byId = new Map<number, any>();
    for (const s of [...byJobRole, ...byEnrollment]) byId.set(s.id, s);
    return [...byId.values()];
  }

  async getFullProfile(username: string, viewer: ProfileViewer) {
    const user = await this.userService.findByUsername(username);
    const canViewContactInfo = viewer.id === user.id || viewer.role === UserRoleEnum.ADMIN;

    const [
      courseStats,
      permissions,
      quizData,
      assessmentData,
      apiUsageRow,
      certificates,
      badgeData,
      globalBadges,
      activities,
      streak,
    ] = await Promise.all([
      this.getCourseStats(user.id),
      this.userPermissionService.getPermissionsForProfile(user.id),
      this.getRecentQuizzes(user.id),
      this.getAssessmentSessions(user.id),
      this.apiUsageService.findByUserId(user.id),
      this.getCertificates(user.id),
      this.achievementService.getUserBadges(user.id),
      this.badgeQueryService.getUserBadgesForScope(BadgeScopeEnum.GLOBAL, undefined, user.id),
      this.activityService.findByUserId(user.id, 20),
      this.userStreakRepository.findOne({ where: { userId: user.id } }),
    ]);

    // Scope title resolution needs badgeData.earned's actual contents, so it can't join the
    // Promise.all above — was previously unresolvable at all (getUserBadges' earned rows carry
    // no title, only scopeType/scopeId numbers), which is exactly why Platform Achievements
    // couldn't show a real scope label for anything beyond the hardcoded Global badges.
    const earnedBadges = await this.achievementService.enrichWithScopeTitles(badgeData.earned);

    return {
      ...user,
      // Overexposed previously: this endpoint had no viewer awareness at all, so any caller who
      // cleared the route guard (e.g. a Manager on /users/view/:userName) received full contact
      // info in the raw response even though the frontend only ever rendered it for self/Admin
      // (UserComponent.canViewPrivateInfo). Enforced here now instead of trusting the template.
      email: canViewContactInfo ? user.email : null,
      mobile: canViewContactInfo ? user.mobile : null,
      permissions,
      courseStats,
      quizzes: quizData,
      api_usage: {
        count: apiUsageRow?.count ?? 0,
        lastHitAt: apiUsageRow?.lastHitAt ?? null,
      },
      self_assessments: assessmentData.self_assessments,
      external_assessments: assessmentData.external_assessments,
      certificates,
      // Earned-only, every scope mixed together — each now carries scopeType/scopeId/scopeLabel
      // (see enrichWithScopeTitles above), so the profile's Platform Achievements widget can
      // show a real caption instead of nothing/"Global" for every non-Global badge.
      badges: earnedBadges,
      // Platform-wide (non-subject/job-role/topic) badges — earned + locked, unlocked-tagged and
      // sortOrder-ordered, same shape subjectDashboard/programDetails embed for their own scopes.
      // Distinct from `badges` above, which is earned-only and mixes every scope together.
      globalBadges,
      activities: activities.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        dataId: a.dataId ?? null,
        dataType: a.dataType ?? null,
        createdAt: a.createdAt,
      })),
      gamification: {
        points: user.points ?? 0,
        level: computeLevel(user.points ?? 0),
        streak: {
          current: streak?.currentStreak ?? 0,
          longest: streak?.longestStreak ?? 0,
        },
      },
    };
  }

  /**
   * Anonymous-safe "credential card" — deliberately a separate method and query surface from
   * getFullProfile rather than one endpoint with conditional field-stripping. A dedicated method
   * that simply never selects/returns email, mobile, quizzes, enrollments, permissions, or
   * settings is safe by construction; a shared method whose safety depends on an if-branch being
   * correct every time is one missed branch away from leaking PII to a visitor. Called from an
   * unguarded route (see users.controller.ts) — no viewer parameter at all, since every caller
   * gets the identical minimal shape regardless of who (or whether anyone) is signed in.
   */
  async getPublicProfile(username: string) {
    const user = await this.userService.findByUsername(username);

    const [courseStats, certificates, badgeData, globalBadges, streak] = await Promise.all([
      this.getCourseStats(user.id),
      this.getCertificates(user.id),
      this.achievementService.getUserBadges(user.id),
      this.badgeQueryService.getUserBadgesForScope(BadgeScopeEnum.GLOBAL, undefined, user.id),
      this.userStreakRepository.findOne({ where: { userId: user.id } }),
    ]);

    return {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      designation: user.designation ?? null,
      image: user.image ?? null,
      city: user.city ?? null,
      country: user.country ?? null,
      about: user.profile?.about ?? null,
      createdAt: user.createdAt,
      gamification: {
        points: user.points ?? 0,
        level: computeLevel(user.points ?? 0),
        streak: {
          current: streak?.currentStreak ?? 0,
          longest: streak?.longestStreak ?? 0,
        },
      },
      // Titles + top-line numbers only — no per-question scores/accuracy, which reads more like
      // a performance review than a public "what they're learning" credential card.
      subjects: courseStats.map((s) => ({ id: s.id, title: s.title, slug: s.slug, image: s.image, color: s.color })),
      badges: badgeData.earned,
      globalBadges,
      certificates: certificates.map((c) => ({
        certificateNumber: c.certificateNumber,
        issuedAt: c.issuedAt,
        skillName: c.skillName,
        tierDisplayName: c.tierDisplayName,
        verificationCode: c.verificationCode,
      })),
    };
  }

  // Wrapped end-to-end (not just logged) — certificates are optional/degradable data (the
  // Certificates tab already has a "No certificates yet" empty state), so a failure here must
  // never take down the rest of getFullProfile/getPublicProfile the way it did once already:
  // this dev DB has had its schema rewritten out from under a running app at least once this
  // week by something outside this codebase (no migration runner or seeder in this repo touches
  // `certificate`'s columns — see project_profile_redesign_v2_implementation.md), dropping the
  // scorePercentage/skillName/tierDisplayName columns added alongside this query and breaking
  // every profile load with a raw "Unknown column" SQL error. This can't be fully prevented from
  // application code, but it no longer needs to be fatal.
  private async getCertificates(userId: number) {
    let rows: any[];
    try {
      rows = await this.dataSource
        .createQueryBuilder()
        .select('c.id', 'certificateId')
        .addSelect('c.certificateNumber', 'certificateNumber')
        .addSelect('c.status', 'status')
        .addSelect('c.issuedAt', 'issuedAt')
        .addSelect('c.expiresAt', 'expiresAt')
        .addSelect('c.pdfUrl', 'pdfUrl')
        .addSelect('c.verificationCode', 'verificationCode')
        .addSelect('c.scorePercentage', 'scorePercentage')
        .addSelect('c.skillName', 'skillName')
        .addSelect('c.tierDisplayName', 'tierDisplayName')
        .addSelect('ct.id', 'certificationTrackId')
        .addSelect('ct.title', 'certificationTrackTitle')
        .addSelect('jr.id', 'jobRoleId')
        .addSelect('jr.title', 'jobRoleTitle')
        .addSelect('jr.slug', 'jobRoleSlug')
        .from('certificate', 'c')
        .innerJoin('certification_track', 'ct', 'ct.id = c.certificationTrackId')
        .leftJoin('certification_track_job_role', 'ctjr', 'ctjr.certificationTrackId = ct.id')
        .leftJoin('job_role', 'jr', 'jr.id = ctjr.jobRoleId')
        .where('c.userId = :userId', { userId })
        .orderBy('c.issuedAt', 'DESC')
        .addOrderBy('ctjr.sortOrder', 'ASC')
        .getRawMany();
    } catch (err) {
      this.logger.error(`getCertificates failed for userId=${userId}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }

    const byCertificate = new Map<
      number,
      {
        certificateNumber: string;
        status: string;
        issuedAt: Date;
        expiresAt: Date;
        pdfUrl: string;
        verificationCode: string;
        scorePercentage: number | null;
        skillName: string | null;
        tierDisplayName: string | null;
        certificationTrack: { id: number; title: string };
        jobRoles: Array<{ id: number; title: string; slug: string }>;
      }
    >();
    for (const r of rows) {
      const certId = +r.certificateId;
      if (!byCertificate.has(certId)) {
        byCertificate.set(certId, {
          certificateNumber: r.certificateNumber,
          status: r.status,
          issuedAt: r.issuedAt,
          expiresAt: r.expiresAt,
          pdfUrl: r.pdfUrl,
          verificationCode: r.verificationCode,
          // Null on any certificate issued before this snapshot was added — the frontend degrades
          // gracefully (omits the score/tier line) rather than showing a fabricated number for
          // pre-existing certs.
          scorePercentage: r.scorePercentage != null ? +r.scorePercentage : null,
          skillName: r.skillName ?? r.certificationTrackTitle ?? null,
          tierDisplayName: r.tierDisplayName ?? null,
          certificationTrack: { id: +r.certificationTrackId, title: r.certificationTrackTitle },
          jobRoles: [],
        });
      }
      if (r.jobRoleId) {
        byCertificate.get(certId).jobRoles.push({
          id: +r.jobRoleId,
          title: r.jobRoleTitle,
          slug: r.jobRoleSlug,
        });
      }
    }

    return Array.from(byCertificate.values());
  }

  private async getRecentQuizzes(userId: number) {
    // QuizResult's quizId/userQuizId are mutually exclusive (Standard/UserQuiz
    // split) — LEFT JOIN both possible parents and COALESCE, since only one will
    // ever match per row.
    const rows = await this.dataSource
      .createQueryBuilder(QuizResult, 'qr')
      .leftJoin('qr.quiz', 'q')
      .leftJoin('qr.userQuiz', 'uq')
      .select([
        'qr.id AS id',
        'qr.resultCode AS resultCode',
        'qr.total AS total',
        'qr.correct AS correct',
        'qr.wrong AS wrong',
        'qr.unanswered AS unanswered',
        'qr.timeSpent AS timeSpent',
        'qr.score AS score',
        'qr.status AS status',
        'qr.createdAt AS createdAt',
        'qr.quizType AS quizType',
        'COALESCE(qr.quizId, qr.userQuizId) AS quizId',
        'COALESCE(q.title, uq.title) AS quizTitle',
        'COALESCE(q.slug, uq.slug) AS quizSlug',
        'COALESCE(q.level, uq.level) AS quizLevel',
      ])
      .where('qr.userId = :userId', { userId })
      .orderBy('qr.createdAt', 'DESC')
      .limit(10)
      .getRawMany();

    const recent = rows.map((r) => ({
      id: r.id,
      resultCode: r.resultCode,
      quiz: {
        id: r.quizId,
        title: r.quizTitle,
        slug: r.quizSlug,
        quizType: r.quizType,
        level: r.quizLevel,
      },
      score: Number(r.score) || 0,
      total: r.total,
      correct: r.correct,
      wrong: r.wrong,
      unanswered: r.unanswered,
      timeSpent: r.timeSpent,
      status: r.status,
      createdAt: r.createdAt,
    }));

    const totalTaken = recent.length;
    const avgScore =
      totalTaken > 0
        ? +(recent.reduce((s, r) => s + r.score, 0) / totalTaken).toFixed(1)
        : 0;
    const totalCorrect = recent.reduce((s, r) => s + (r.correct || 0), 0);
    const totalWrong = recent.reduce((s, r) => s + (r.wrong || 0), 0);

    return {
      recent,
      summary: { totalTaken, avgScore, totalCorrect, totalWrong },
    };
  }

  private async getAssessmentSessions(userId: number) {
    const [selfSessions, interviewSessions] = await Promise.all([
      this.fetchSessionsByType(userId, RatingTypeEnum.SELF),
      this.fetchSessionsByType(userId, RatingTypeEnum.INTERVIEW),
    ]);

    return {
      self_assessments: {
        sessions: selfSessions,
        summary: this.buildAssessmentSummary(selfSessions),
      },
      external_assessments: {
        sessions: interviewSessions,
        summary: this.buildAssessmentSummary(interviewSessions),
      },
    };
  }

  private async fetchSessionsByType(
    userId: number,
    ratingType: RatingTypeEnum,
  ) {
    const sessions = await this.dataSource
      .getRepository(AssessmentSession)
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.skillRatings', 'sr')
      .where('s.userId = :userId', { userId })
      .andWhere('s.ratingType = :ratingType', { ratingType })
      .orderBy('s.createdAt', 'DESC')
      .take(5)
      .getMany();

    return sessions.map((s) => ({
      id: s.id,
      assessmentTitle: s.assessmentTitle,
      ratingType: s.ratingType,
      createdAt: s.createdAt,
      skillRatings: (s.skillRatings || []).map((r) => ({
        skillId: r.skillId,
        skillType: r.skillType,
        rating: r.rating,
      })),
    }));
  }

  private buildAssessmentSummary(sessions: Array<{ skillRatings: Array<{ rating: number }> }>) {
    const totalSessions = sessions.length;
    if (!totalSessions) return { totalSessions: 0, avgRating: 0 };

    const allRatings = sessions.flatMap((s) =>
      s.skillRatings.map((r) => r.rating),
    );
    const avgRating =
      allRatings.length > 0
        ? +(
            allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
          ).toFixed(1)
        : 0;

    return { totalSessions, avgRating };
  }
}
