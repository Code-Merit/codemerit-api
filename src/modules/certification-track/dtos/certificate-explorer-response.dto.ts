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
}

export class CertificateExplorerTrackDto {
  id: number;
  title: string;
  description: string | null;
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
  // Authoritative from an actual issued Certificate row — never re-derived from progressPercent
  // vs. achievementThreshold, since issuance is the real event and progress can drift afterwards.
  isAchieved: boolean;
  subjectTracks: CertExplorerSubjectTrackDto[];
  myCertificate: CertExplorerMyCertificateDto | null;
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
