import { Injectable } from '@nestjs/common';
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
import { UserService } from './user.service';

@Injectable()
export class UserProfileAggregatorService {
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

  async getFullProfile(username: string) {
    const user = await this.userService.findByUsername(username);

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
      this.subjectAnalysisService.getJobSubjectDashboards(user.id, false),
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

    return {
      ...user,
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
      badges: badgeData.earned,
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

  private async getCertificates(userId: number) {
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('c.id', 'certificateId')
      .addSelect('c.certificateNumber', 'certificateNumber')
      .addSelect('c.status', 'status')
      .addSelect('c.issuedAt', 'issuedAt')
      .addSelect('c.expiresAt', 'expiresAt')
      .addSelect('c.pdfUrl', 'pdfUrl')
      .addSelect('c.verificationCode', 'verificationCode')
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

    const byCertificate = new Map<
      number,
      {
        certificateNumber: string;
        status: string;
        issuedAt: Date;
        expiresAt: Date;
        pdfUrl: string;
        verificationCode: string;
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
    const rows = await this.dataSource
      .createQueryBuilder(QuizResult, 'qr')
      .leftJoin('qr.quiz', 'q')
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
        'q.id AS quizId',
        'q.title AS quizTitle',
        'q.slug AS quizSlug',
        'q.quizType AS quizType',
        'q.level AS quizLevel',
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
