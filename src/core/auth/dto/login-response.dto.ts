import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { UserPermission } from 'src/common/typeorm/entities/user-permission.entity';
import { AccountStatusEnum } from 'src/core/users/enums/account-status.enum';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';
import {
  JobRoleSubjectsBreakdown,
  SubjectEnrollmentSummary,
} from 'src/modules/skill-enrollment/providers/skill-enrollment.service';

export class LoginResponseDto implements LoginUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  username: string;
  role: UserRoleEnum;

  city?: string | null;
  country: string | null;
  mobile?: string | null;
  image?: string | null;
  level?: string | null;
  points?: number;
  accountStatus: AccountStatusEnum;
  token: string;
  //other conditional fields
  profile: Profile;
  permissions?: UserPermission[];
  courseStats?: any;
  quizStats?: any;
  topicStats?: any;
  // Career-path *targets* (UserJobRole) — aspirational, carries no access entitlement.
  // Kept separate from jobRoleEnrollments below, which reflects real SkillEnrollment
  // access; a role can appear in one list, both, or neither.
  userJobRoles?: Array<{
    userId: number;
    jobRoleId: number;
    jobRoleTitle: string;
    createdAt: Date;
  }>;
  // Real, active (non-expired) access — the source of truth for post-login redirection.
  // Sole source: SkillEnrollment. subjectEnrollments is the direct per-subject read;
  // jobRoleEnrollments is derived (a role appears here once the caller holds an active
  // enrollment for at least one of that role's subjects — see
  // SkillEnrollmentService.getMyEnrollmentSummary()).
  subjectEnrollments?: SubjectEnrollmentSummary[];
  jobRoleEnrollments?: JobRoleSubjectsBreakdown[];
  apiUsage?: {
    count: number;
    lastHitAt: Date | null;
  };
  //fields for admin
  lmsMetrics: {
    numAllQuestions: number;
    numAllPublishedQuestions: number;
    numTriviaQuestions: number;
    numAllTopics: number;
    numAllSubjects: number;
    numAllInterviews: number;
    numAllQuiz: number;
  };
  userMetrics: {
    totalUsers: number;
    pendingUsers: number;
    activeUsers: number;
  };

  constructor(partial: Partial<LoginResponseDto>) {
    Object.assign(this, partial);
  }
}

export interface LoginUser {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  username: string;
  role: UserRoleEnum;

  city?: string | null;
  country: string | null;
  mobile?: string | null;
  image?: string | null;
  level?: string | null;
  points?: number;
  accountStatus: AccountStatusEnum;
  token: string;
}
