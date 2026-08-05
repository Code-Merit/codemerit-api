import { WorkStatusEnum } from 'src/core/users/enums/work-status.enum';
import { IntentEnum } from 'src/core/users/enums/intent.enum';
import { TimelineEnum } from 'src/core/users/enums/timeline.enum';
import { ReferralSourceEnum } from 'src/core/users/enums/referral-source.enum';

export interface IProfile {
  id: number;
  linkedinUrl?: string;
  about?: string;
  googleId?: string;
  linkedinId?: string;
  auth_provider?: string;
  experience?: number;
  workStatus?: WorkStatusEnum;
  collegeName?: string;
  stream?: string;
  passingYear?: string;
  hasCompletedInternship?: boolean;
  internshipDuration?: number;
  isCurrentlyEmployed?: boolean;
  companyName?: string;
  subjectTrackId?: number;
  masteryLevel?: number;
  intent?: IntentEnum;
  timeline?: TimelineEnum;
  referralSource?: ReferralSourceEnum;
  profileCompleted?: boolean;
  userId: number;
}
