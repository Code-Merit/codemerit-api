// Shape matches the frontend's existing CertTrackSubjectSummary (subject-dashboard.model.ts)
// exactly, so a track built from this DTO can be fed straight into <app-certification-tracks>
// with no per-field remapping.
export class CertExplorerSubjectTrackDto {
  id: number;
  title: string;
  slug: string;
  sortOrder: number;
  totalTopics: number;
  subject: { id: number; title: string; slug: string };
  progressPercent: number;
  isCompleted: boolean;
  // "How long is this track" / "what's in it" — same numTrivia/attempted/correct fields
  // SubjectTrackAnalysisService.buildSubjectTrackMap() already computes per subject-track for
  // the dashboard; just never read off into a certification-facing DTO until now.
  totalQuestions: number;
  attempted: number;
  correct: number;
  // Sum of Question.timeAllowed (seconds) across this subject track's Trivia bank — "how long
  // would it take to answer every question here." See SubjectTrackAnalysisService's
  // totalTimeAllowedSeconds for the source computation.
  estimatedTimeSeconds: number;
  // Topic titles within this subject track — backs the public "/certification/:slug" invite
  // page's "Your Path" section, which names exactly what's covered rather than just a count.
  topicTitles: string[];
}

export class CertExplorerJobRoleDto {
  id: number;
  title: string;
  slug: string;
}

// Richer than MyCertificate (certificate.model.ts's slim shape) — carries every field the real
// <app-certificate> face needs to render, same set UserProfileAggregatorService.getCertificates()
// already returns as ProfileCertificate.
export class CertExplorerMyCertificateDto {
  certificateNumber: string;
  status: string;
  issuedAt: Date;
  expiresAt: Date | null;
  pdfUrl: string | null;
  verificationCode: string | null;
  scorePercentage: number | null;
  skillName: string | null;
  tierDisplayName: string | null;
  // Fully-resolved certificate face copy snapshotted at issuance (see Certificate.content).
  content: string | null;
}

export class CertificateExplorerTrackDto {
  id: number;
  title: string;
  // Stable, human-readable identifier for the public "/certification/:slug" invite page —
  // set once at creation (CertificationTrackService#create) and never regenerated, so a
  // shared link keeps working even after the track is renamed.
  slug: string;
  description: string | null;
  // Certificate face template (may contain {{userName}}/{{skillName}} tokens) — used to render a
  // "preview" face for a not-yet-earned track. The real, resolved copy lives on myCertificate.content.
  content: string | null;
  subjectId: number | null;
  jobRoles: CertExplorerJobRoleDto[];
  totalSubjectTracks: number;
  completedSubjectTracks: number;
  progressPercent: number;
  achievementThreshold: number;
  // Roll-ups across subjectTracks below — "content volume + your attempt" for the whole track.
  totalQuestions: number;
  questionsAttempted: number;
  questionsCorrect: number;
  // Rolled up across subjectTracks' own estimatedTimeSeconds — "how long to complete this
  // certification," based on each question's allotted time (Question.timeAllowed), not
  // actual attempt time. The UI rounds this to minutes.
  estimatedTimeSeconds: number;
  // Fewest correct answers that can earn this certification from scratch — see
  // minCorrectForCertification() in common/utils/completion-rules.ts. null when it can't be
  // earned yet (e.g. topics still without Trivia questions).
  correctAnswersToEarn: number | null;
  // Authoritative from an actual issued Certificate row — never re-derived from progressPercent
  // vs. achievementThreshold, since issuance is the real event and progress can drift afterwards.
  isAchieved: boolean;
  subjectTracks: CertExplorerSubjectTrackDto[];
  myCertificate: CertExplorerMyCertificateDto | null;
  // Free-text, admin-authored note — see CertificationTrack.note's own comment. Drives the
  // public "/certification/:slug" page's quote strip; that section hides entirely when null.
  note: string | null;
  // Always true from getExplorer() (it only ever queries isPublished:true tracks) — false only
  // on the "pending approval" fallback path in getPublicTrack(), for a real track that exists
  // but hasn't been published yet. The public "/certification/:slug" page uses this to show an
  // "undergoing approval" notice instead of the full invite experience.
  isPublished: boolean;
}

// One group per job role (a job-role-bundle track can link to several roles and legitimately
// appears under each one) or one group per subject (subject-native tracks) — no more single
// catch-all "Platform" bucket, which hid real structure behind one inflated count.
export class CertificateExplorerGroupDto {
  scopeType: 'JobRole' | 'Subject';
  scopeId: number | null;
  scopeTitle: string | null;
  tracks: CertificateExplorerTrackDto[];
}

export class CertificateExplorerResponseDto {
  groups: CertificateExplorerGroupDto[];
  earned: CertificateExplorerTrackDto[];
  inProgress: CertificateExplorerTrackDto[];
  // Powers empty-state copy selection (enrolled-but-not-started vs. never-enrolled) without a
  // second client-side call — same enrolledSubjectIds this response already computes.
  hasAnyEnrollment: boolean;
}
