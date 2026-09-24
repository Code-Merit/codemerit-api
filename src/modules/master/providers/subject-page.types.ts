import { UserLessonTrackerStatusEnum } from 'src/common/enum/user-lesson-tracker-status.enum';
import { ScopedBadgeDto } from '../../achievement/providers/badge-query.service';

// The response contract for MasterController's GET apis/master/subjectDashboard
// (SubjectStatsService.getSubjectPage) — shared verbatim by the Subject Dashboard and
// Subject Curriculum frontend pages. Kept in one file so the two producers of this shape
// (getSubjectPage's own return object, computeNextAction) and any future consumer all read
// off the same contract instead of drifting silently — see the now-removed `syllabus` field
// on the frontend's SubjectDashboard model, which existed for years without the backend ever
// having sent it.
//
// `subjectTracks`, `meritList` and `popularTopics` stay `any[]` — their producers
// (SubjectTrackAnalysisService.getSubjectTracksBySubject, MeritService's shaped rows) aren't
// typed yet themselves, so typing them here would just be a second guess at a shape that
// isn't the source of truth. Follow-up, not part of this pass.

export type SubjectNextAction =
  | {
      type: 'resume-lesson';
      lessonId: number;
      title: string;
      slug: string;
      topicId: number;
      topicTitle: string;
      progressPercent: number;
    }
  | {
      type: 'learn-lesson';
      topicId: number;
      topicTitle: string;
      lessonId: number | null;
      lessonTitle: string | null;
      lessonSlug: string | null;
      lessonsCompleted: number;
      lessonsTotal: number;
    }
  | {
      type: 'quiz';
      topicId: number;
      topicTitle: string;
      subjectTrackId: number | null;
      subjectTrackTitle: string | null;
      score: number;
      currentAccuracy: number;
      coverage: number;
    }
  | {
      type: 'certification';
      certificationTrackId: number;
      title: string;
      progressPercent: number;
    }
  | { type: 'caught-up' };

export interface SubjectPageLessonItem {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  level: number;
  format: string;
  topicId: number | null;
  topicTitle: string | null;
  topicSlug: string | null;
  numSections: number;
  status: UserLessonTrackerStatusEnum | null;
  views: number;
  progressPercent: number;
  lastActivityAt: Date | string | null;
}

export interface SubjectPageLessons {
  total: number;
  completed: number;
  inProgress: number;
  totalViews: number;
  lastActivityAt: Date | string | null;
  learningCompleteness: number;
  list: SubjectPageLessonItem[];
}

// General questions (Question.questionType = 'General') are a separate completion track from
// Trivia — a learner reads one and marks it complete via UserQuestionTracker (one-way, no
// partial-progress concept, unlike lessons' Pending/Read/Completed states), so this shape is
// deliberately flatter than SubjectPageLessons: no `inProgress`, no per-item `list` (the
// standalone /interview-questions page already owns browsing; this is a summary rollup only).
export interface SubjectPageGeneralQuestions {
  total: number;
  completed: number;
  completionPercent: number;
}

export interface SubjectPageCertSubjectTrack {
  id: number;
  title: string;
  slug: string;
  totalTopics: number;
  subject: { id: number; title: string; slug: string };
  progressPercent: number;
  score: number;
  isCompleted: boolean;
  attemptedEasy: number;
  attemptedMedium: number;
  attemptedHard: number;
  correctEasy: number;
  correctMedium: number;
  correctHard: number;
  wrongEasy: number;
  wrongMedium: number;
  wrongHard: number;
  userLevel: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
}

export interface SubjectPageCertificationTrack {
  id: number;
  title: string;
  description: string;
  sortOrder: number;
  totalSubjectTracks: number;
  completedSubjectTracks: number;
  progressPercent: number;
  achievementThreshold: number;
  totalQuestions: number;
  questionsAttempted: number;
  questionsCorrect: number;
  subjectTracks: SubjectPageCertSubjectTrack[];
  // undefined (not []) when there's no published job role at all — see this field's own
  // comment in getCertificationTracksForSubject for why the frontend template depends on that.
  roleTitles?: string[];
  // Only ever set (even to null) for authenticated requests — see getCertificationTracksForSubject.
  myCertificate?: { certificateNumber: string; status: string; issuedAt: Date; pdfUrl: string } | null;
  isAchieved: boolean;
}

export interface SubjectPageRelatedJobRole {
  id: number;
  title: string;
  slug: string;
  image: string;
  color: string;
  tag: string;
}

export interface SubjectPageSkillRating {
  id: number;
  skillId: number;
  skillType: string;
  rating: number;
  createdAt: Date;
}

export interface SubjectPageAssessmentRating {
  id: number;
  assessmentTitle: string;
  createdAt: Date;
  ratingType: string;
  ratedByName: string | null;
  skillRatings: SubjectPageSkillRating[] | undefined;
}

export interface SubjectPageDetailSelfRating {
  totalTopics: number;
  averageRating: number;
  lastRatedAt: Date;
}

export interface SubjectPageResponse {
  id: number;
  title: string;
  description: string;
  image: string;
  slug: string;
  color: string;
  isPublished: boolean;
  numQuestions: number;
  numTrivia: number;
  numEasyTrivia: number;
  numIntTrivia: number;
  numAdvTrivia: number;
  isSubscribed: boolean;
  attempted: number;
  attemptedEasy: number;
  attemptedMedium: number;
  attemptedHard: number;
  correct: number;
  correctEasy: number;
  correctMedium: number;
  correctHard: number;
  userLevel: string;
  skipped: number;
  wrong: number;
  wrongEasy: number;
  wrongMedium: number;
  wrongHard: number;
  currentAccuracy: number;
  coverage: number;
  score: number;
  journeyAttempts: number;
  journeyCorrect: number;
  journeyWrong: number;
  journeyAccuracy: number;
  journeyScore: number;
  userRank: number | null;
  subjectTracks: any[];
  certificationTracks: SubjectPageCertificationTrack[];
  lessons: SubjectPageLessons;
  generalQuestions: SubjectPageGeneralQuestions;
  nextAction: SubjectNextAction;
  relatedJobRoles: SubjectPageRelatedJobRole[];
  meritList: any[];
  popularTopics: any[];
  subjectRatings: SubjectPageAssessmentRating[];
  badges: ScopedBadgeDto[];
  detailSelfRating: SubjectPageDetailSelfRating | null;
}
