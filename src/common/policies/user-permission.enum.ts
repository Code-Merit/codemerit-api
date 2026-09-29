export enum UserPermissionTitleEnum {
  Subject = 'subject',
  Topic = 'topic',
  Question = 'question',
  SubjectTrack = 'subject-track',
  CertificationTrack = 'certification-track',
  JobRole = 'job-role',
  Badge = 'badge',
}
export enum UserPermissionEnum {
  TopicGet = 'Topic:Get',
  TopicCreate = 'Topic:Create',
  TopicUpdate = 'Topic:Update',
  TopicDelete = 'Topic:Delete',
  QuestionAuthorCreate = 'QuestionAuthor:Create',
  QuestionAuthorUpdate = 'QuestionAuthor:Update',
  QuestionAuthorDelete = 'QuestionAuthor:Delete',
  LmsManager = 'LmsManager',
  SubjectTrackGet = 'SubjectTrack:Get',
  SubjectTrackCreate = 'SubjectTrack:Create',
  SubjectTrackUpdate = 'SubjectTrack:Update',
  SubjectTrackDelete = 'SubjectTrack:Delete',
  CertificationTrackGet = 'CertificationTrack:Get',
  CertificationTrackCreate = 'CertificationTrack:Create',
  CertificationTrackUpdate = 'CertificationTrack:Update',
  CertificationTrackDelete = 'CertificationTrack:Delete',
  CertificationTrackGrant = 'CertificationTrack:Grant',
  BadgeGrant = 'Badge:Grant',
  // Scoped per subject (resourceType: Subject, resourceId: subjectId) via the same
  // UserPermission grant table as the Resource:Action permissions above — deliberately NOT
  // "Role:"-prefixed since it's never a global grant. Lets the SME quality-review pool grow
  // without handing out full LmsManager (which stays global-only, see QuestionReviewAccessGuard).
  QuestionReview = 'Question:Review',
  Sme = 'SME',

  // "Role:" prefix marks broad, unscoped capability grants (job-title-style access),
  // as distinct from the Resource:Action permissions above which are scoped to a
  // specific resourceType/resourceId. Ladders: LmsManager < LearningManager < LearningAdmin;
  // AssociateSme < Sme < SmeLead.
  TalentPartner = 'Role:TalentPartner',
  LearningManager = 'Role:LearningManager',
  LearningAdmin = 'Role:LearningAdmin',
  AssociateSme = 'Role:AssociateSME',
  SmeLead = 'Role:SMELead',
  OrganizationOwner = 'Role:OrganizationOwner',
  ProLearner = 'Role:ProLearner',
  InterviewManager = 'Role:InterviewManager'
}
