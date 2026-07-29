// ---------------------
// Generic Time Series Types
// ---------------------
export interface DailySeriesItem {
  date: string; // ISO date string
  count: number;
}

export interface WeeklySeriesItem {
  week: string; // e.g. "2025-W43"
  count: number;
}

export interface TrendSeries {
  users: DailySeriesItem[] | WeeklySeriesItem[];
  questions: DailySeriesItem[] | WeeklySeriesItem[];
  quizzes: DailySeriesItem[] | WeeklySeriesItem[];
  attempts: DailySeriesItem[] | WeeklySeriesItem[];
  certificates: DailySeriesItem[] | WeeklySeriesItem[];
  badges: DailySeriesItem[] | WeeklySeriesItem[];
  interviews: DailySeriesItem[] | WeeklySeriesItem[];
}

export interface TrendsStats {
  daily: TrendSeries;
  weekly: TrendSeries;
}

// ---------------------
// Overview
// ---------------------
export interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalPrograms: number;
  totalCertificationTracks: number;
  totalSubjectTracks: number;
  totalSubjects: number;
  totalTopics: number;
  totalQuestions: number;
  totalQuizzes: number;
  totalLessons: number;
  totalQuizAttempts: number;
  totalQuestionAttempts: number;
  certificatesIssued: number;
  badgesAwarded: number;
  totalInterviews: number;
}

// ---------------------
// People
// ---------------------
export interface PeopleStats {
  users: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    admins: number;
    moderators: number;
    learners: number;
    withDesignation: number;
  };
  growth: {
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  streaks: {
    usersWithActiveStreak: number;
    avgCurrentStreak: number;
    longestStreakEver: number;
  };
  topLearners: {
    id: number;
    name: string;
    image: string | null;
    level: string | null;
    points: number;
  }[];
}

// ---------------------
// Content (LMS structure)
// ---------------------
export interface PublishedStats {
  total: number;
  published: number;
  draft: number;
}

export interface QuestionStats {
  total: number;
  byType: {
    trivia: { total: number; active: number; pending: number };
    general: { total: number; active: number; pending: number };
  };
  byLevel: {
    easy: number;
    intermediate: number;
    advanced: number;
  };
}

export interface ContentStats {
  programs: PublishedStats;
  certificationTracks: PublishedStats;
  subjectTracks: PublishedStats;
  subjects: PublishedStats;
  topics: PublishedStats;
  questions: QuestionStats;
  lessons: { total: number };
  moderationQueue: {
    pendingQuestions: number;
    unpublishedSubjects: number;
    unpublishedTopics: number;
    unpublishedSubjectTracks: number;
    unpublishedCertificationTracks: number;
  };
}

// ---------------------
// Engagement
// ---------------------
export interface EngagementStats {
  quizzes: {
    total: number;
    published: number;
    draft: number;
    byType: { userQuiz: number; standard: number };
    playedQuizzes: number;
    totalPlays: number;
    avgPlaysPerQuiz: number;
    avgScore: number;
    topQuizzes: { id: number; title: string; plays: number }[];
  };
  questionAttempts: {
    total: number;
    correct: number;
    wrong: number;
    skipped: number;
    distinctUsers: number;
    accuracyPercent: number;
  };
  lessons: {
    totalViews: number;
    totalPending: number;
    totalCompleted: number;
    completionRate: number;
  };
}

// ---------------------
// Achievements
// ---------------------
export interface AchievementStats {
  certificates: {
    totalIssued: number;
    totalRevoked: number;
    totalExpired: number;
    uniqueHolders: number;
    issuedThisWeek: number;
    issuedThisMonth: number;
    topCertificationTracks: { id: number; title: string; issuedCount: number }[];
  };
  badges: {
    totalAvailable: number;
    totalAwarded: number;
    uniqueEarners: number;
    byScope: { global: number; subject: number; jobRole: number; topic: number };
    topBadges: { code: string; name: string; scopeType: string | null; earnCount: number }[];
    rareBadges: { code: string; name: string; scopeType: string; earnCount: number }[];
  };
}

// ---------------------
// Interviews
// ---------------------
export interface InterviewStats {
  total: number;
  byStatus: { scheduled: number; inProgress: number; completed: number; cancelled: number };
  roundsByStatus: { assigned: number; started: number; completed: number; declined: number; cancelled: number };
  scheduledThisWeek: number;
  scheduledThisMonth: number;
  completionRate: number;
  declineRate: number;
  topInterviewers: { id: number; name: string; roundsCompleted: number }[];
}

// ---------------------
// Recent Activity
// ---------------------
export interface RecentActivityItem {
  id: number;
  title: string;
  message: string;
  userId: number;
  userName: string | null;
  dataType: string | null;
  dataId: string | null;
  createdAt: Date;
}

// ---------------------
// Combined Dashboard Data
// ---------------------
export interface DashboardMeta {
  /** true if one or more sections below fell back to zeroed/empty data because their query
   * failed — the rest of the response is still real data, this just flags that some isn't. */
  partial: boolean;
  /** Names of the top-level keys (e.g. "achievements", "trends") that failed and are showing
   * fallback data. Empty when `partial` is false. */
  failedSections: string[];
}

export interface AdminDashboardData {
  overview: OverviewStats;
  people: PeopleStats;
  content: ContentStats;
  engagement: EngagementStats;
  achievements: AchievementStats;
  interviews: InterviewStats;
  recentActivity: RecentActivityItem[];
  trends: TrendsStats;
  meta: DashboardMeta;
}

export interface AdminDashboardResponse {
  error: boolean;
  result_code: number;
  message: string;
  data: AdminDashboardData;
}
