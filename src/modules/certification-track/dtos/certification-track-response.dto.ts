export class CertTrackSubjectTrackDto {
  id: number;
  title: string;
  slug: string;
  subjectId: number;
  subjectName: string;
  topicCount: number;
}

export class CertTrackJobRoleDto {
  jobRoleId: number;
  jobRoleTitle: string;
  sortOrder: number;
  isPublished: boolean;
  descriptionOverride: string;
}

export class CertificationTrackResponseDto {
  id: number;
  title: string;
  slug: string;
  description: string;
  content: string | null;
  subjectId: number | null;
  passThreshold: number | null;
  isPublished: boolean;
  note: string | null;
  popularity: number;
  jobRoles: CertTrackJobRoleDto[];
  subjectTrackCount: number;
  subjectTracks: CertTrackSubjectTrackDto[];
}
