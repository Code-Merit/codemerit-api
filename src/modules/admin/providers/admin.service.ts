import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from 'src/common/typeorm/entities/activity.entity';
import { AdminPeopleService } from './admin-people.service';
import { AdminContentService } from './admin-content.service';
import { AdminEngagementService } from './admin-engagement.service';
import { AdminAchievementsService } from './admin-achievements.service';
import { AdminInterviewsService } from './admin-interviews.service';
import { AdminTrendsService } from './admin-trends.service';
import {
  PeopleStats,
  ContentStats,
  EngagementStats,
  AchievementStats,
  InterviewStats,
  RecentActivityItem,
  TrendsStats,
} from '../dtos/admin-dashboard.model';

// Zeroed fallbacks for each section — shaped exactly like a real (empty) result, so a section
// that fails to load renders identically to "no data yet" instead of leaving frontend fields
// undefined. Paired with `meta.failedSections` (set when the fallback is actually used) so the
// frontend can still tell "genuinely empty" apart from "failed to load" if it wants to.
const EMPTY_PEOPLE: PeopleStats = {
  users: { total: 0, active: 0, pending: 0, blocked: 0, admins: 0, moderators: 0, learners: 0, withDesignation: 0 },
  growth: { newToday: 0, newThisWeek: 0, newThisMonth: 0 },
  streaks: { usersWithActiveStreak: 0, avgCurrentStreak: 0, longestStreakEver: 0 },
  topLearners: [],
};

const EMPTY_CONTENT: ContentStats = {
  programs: { total: 0, published: 0, draft: 0 },
  certificationTracks: { total: 0, published: 0, draft: 0 },
  subjectTracks: { total: 0, published: 0, draft: 0 },
  subjects: { total: 0, published: 0, draft: 0 },
  topics: { total: 0, published: 0, draft: 0 },
  questions: {
    total: 0,
    byType: { trivia: { total: 0, active: 0, pending: 0 }, general: { total: 0, active: 0, pending: 0 } },
    byLevel: { easy: 0, intermediate: 0, advanced: 0 },
  },
  lessons: { total: 0 },
  moderationQueue: {
    pendingQuestions: 0,
    unpublishedSubjects: 0,
    unpublishedTopics: 0,
    unpublishedSubjectTracks: 0,
    unpublishedCertificationTracks: 0,
  },
};

const EMPTY_ENGAGEMENT: EngagementStats = {
  quizzes: {
    total: 0, published: 0, draft: 0,
    byType: { userQuiz: 0, standard: 0 },
    playedQuizzes: 0, totalPlays: 0, avgPlaysPerQuiz: 0, avgScore: 0,
    topQuizzes: [],
  },
  questionAttempts: { total: 0, correct: 0, wrong: 0, skipped: 0, distinctUsers: 0, accuracyPercent: 0 },
  lessons: { totalViews: 0, totalPending: 0, totalCompleted: 0, completionRate: 0 },
};

const EMPTY_ACHIEVEMENTS: AchievementStats = {
  certificates: {
    totalIssued: 0, totalRevoked: 0, totalExpired: 0, uniqueHolders: 0,
    issuedThisWeek: 0, issuedThisMonth: 0, topCertificationTracks: [],
  },
  badges: {
    totalAvailable: 0, totalAwarded: 0, uniqueEarners: 0,
    byScope: { global: 0, subject: 0, jobRole: 0, topic: 0 },
    topBadges: [], rareBadges: [],
  },
};

const EMPTY_INTERVIEWS: InterviewStats = {
  total: 0,
  byStatus: { scheduled: 0, inProgress: 0, completed: 0, cancelled: 0 },
  roundsByStatus: { assigned: 0, started: 0, completed: 0, declined: 0, cancelled: 0 },
  scheduledThisWeek: 0,
  scheduledThisMonth: 0,
  completionRate: 0,
  declineRate: 0,
  topInterviewers: [],
};

const EMPTY_TREND_SERIES = { users: [], questions: [], quizzes: [], attempts: [], certificates: [], badges: [], interviews: [] };
const EMPTY_TRENDS: TrendsStats = { daily: { ...EMPTY_TREND_SERIES }, weekly: { ...EMPTY_TREND_SERIES } };

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,

    private readonly peopleService: AdminPeopleService,
    private readonly contentService: AdminContentService,
    private readonly engagementService: AdminEngagementService,
    private readonly achievementsService: AdminAchievementsService,
    private readonly interviewsService: AdminInterviewsService,
    private readonly trendsService: AdminTrendsService,
  ) {}

  async getDashboardSummary() {
    const [
      { value: people, failed: peopleFailed },
      { value: content, failed: contentFailed },
      { value: engagement, failed: engagementFailed },
      { value: achievements, failed: achievementsFailed },
      { value: interviews, failed: interviewsFailed },
      { value: recentActivity, failed: recentActivityFailed },
      { value: trends, failed: trendsFailed },
    ] = await Promise.all([
      this.settle('people', this.peopleService.getPeopleStats(), EMPTY_PEOPLE),
      this.settle('content', this.contentService.getContentStats(), EMPTY_CONTENT),
      this.settle('engagement', this.engagementService.getEngagementStats(), EMPTY_ENGAGEMENT),
      this.settle('achievements', this.achievementsService.getAchievementStats(), EMPTY_ACHIEVEMENTS),
      this.settle('interviews', this.interviewsService.getInterviewStats(), EMPTY_INTERVIEWS),
      this.settle('recentActivity', this.getRecentActivity(), [] as RecentActivityItem[]),
      this.settle('trends', this.trendsService.getTrends(), EMPTY_TRENDS),
    ]);

    const overview = {
      totalUsers: people.users.total,
      activeUsers: people.users.active,
      newUsersToday: people.growth.newToday,
      totalPrograms: content.programs.total,
      totalCertificationTracks: content.certificationTracks.total,
      totalSubjectTracks: content.subjectTracks.total,
      totalSubjects: content.subjects.total,
      totalTopics: content.topics.total,
      totalQuestions: content.questions.total,
      totalQuizzes: engagement.quizzes.total,
      totalLessons: content.lessons.total,
      totalQuizAttempts: engagement.quizzes.totalPlays,
      totalQuestionAttempts: engagement.questionAttempts.total,
      certificatesIssued: achievements.certificates.totalIssued,
      badgesAwarded: achievements.badges.totalAwarded,
      totalInterviews: interviews.total,
    };

    const failedSections = [
      peopleFailed && 'people',
      contentFailed && 'content',
      engagementFailed && 'engagement',
      achievementsFailed && 'achievements',
      interviewsFailed && 'interviews',
      recentActivityFailed && 'recentActivity',
      trendsFailed && 'trends',
    ].filter((s): s is string => !!s);

    return {
      overview,
      people,
      content,
      engagement,
      achievements,
      interviews,
      recentActivity,
      trends,
      meta: { partial: failedSections.length > 0, failedSections },
    };
  }

  /** Runs one dashboard section in isolation: a query failure here (bad join, transient DB
   * error, schema drift on one table) is logged and swapped for a zeroed fallback instead of
   * rejecting the whole dashboard — the other sections still load normally. Widgets are already
   * one-section-per-card (see the frontend guide), so this failure boundary matches how the
   * response is actually consumed. */
  private async settle<T>(
    label: string,
    promise: Promise<T>,
    fallback: T,
  ): Promise<{ value: T; failed: boolean }> {
    try {
      return { value: await promise, failed: false };
    } catch (err) {
      this.logger.error(
        `Dashboard section "${label}" failed to load: ${err?.message ?? err}`,
        err?.stack,
      );
      return { value: fallback, failed: true };
    }
  }

  private async getRecentActivity(limit = 15): Promise<RecentActivityItem[]> {
    const rows = await this.activityRepo
      .createQueryBuilder('activity')
      .leftJoin('activity.user', 'user')
      .select([
        'activity.id as id',
        'activity.title as title',
        'activity.message as message',
        'activity.userId as userId',
        'activity.dataType as dataType',
        'activity.dataId as dataId',
        'activity.createdAt as createdAt',
        'user.firstName as firstName',
        'user.lastName as lastName',
      ])
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r) => ({
      id: +r.id,
      title: r.title,
      message: r.message,
      userId: +r.userId,
      userName: [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
      dataType: r.dataType ?? null,
      dataId: r.dataId ?? null,
      createdAt: r.createdAt,
    }));
  }
}
