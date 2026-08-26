import { UserRoleEnum } from '../enums/user-roles.enum';
import { AccountStatusEnum } from '../enums/account-status.enum';
import { Profile } from 'src/common/typeorm/entities/profile.entity';

export interface UserProfileResponseDto {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  username?: string;
  role?: UserRoleEnum;
  designation?: string;
  city?: string;
  country?: string;
  mobile?: string;
  image?: string;
  level?: string;
  points?: number;
  accountStatus?: AccountStatusEnum;
  // Already flows through getFullProfile's `...user` spread into the real response today
  // (UserProfileResponse.createdAt on the frontend reads it) — just missing from this type
  // until getPublicProfile() needed to reference it directly instead of via a blind spread.
  createdAt?: Date;
  profile: Profile;
  /** The caller's own permission grants (only populated on the self "/users/me" lookup). */
  permissions?: unknown[];
}
