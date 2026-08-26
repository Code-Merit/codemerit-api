import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { AccountStatusEnum } from 'src/core/users/enums/account-status.enum';
import { UserOtpTagsEnum } from 'src/core/users/enums/user-otp-Tags.enum';
import { UserProfileService } from 'src/core/users/providers/user-profile.service';
import { UserService } from 'src/core/users/providers/user.service';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { SkillEnrollmentService } from 'src/modules/skill-enrollment/providers/skill-enrollment.service';
import { UserPermissionService } from 'src/modules/user-permission/providers/user-permission.service';
import { DataSource, Repository } from 'typeorm';
import { AccountVerificationDto } from '../dto/account-verification.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { LinkedInOAuthService } from './linkedin-oauth.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
  );
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly userProfileService: UserProfileService,
    private readonly userPermissionService: UserPermissionService,
    private readonly skillEnrollmentService: SkillEnrollmentService,
    private readonly activityService: ActivityService,
    private readonly linkedInOAuth: LinkedInOAuthService,

    @InjectRepository(UserJobRole)
    private userJobRoleRepo: Repository<UserJobRole>,
    private readonly dataSource: DataSource,
  ) { }

  async validateUser(email: string, pass: string) {
    if (email && pass) {
      const user = await this.usersService.findByEmailForLogin(email);
      if (!user) {
        throw new AppCustomException(
          HttpStatus.BAD_REQUEST,
          'User account not found.',
        );
      }
      if (user && (await bcrypt.compare(pass, user.password))) {
        const { password, ...result } = user;
        return result;
      } else {
        throw new AppCustomException(
          HttpStatus.BAD_REQUEST,
          'Incorrect Password. Please try again.',
        );
      }
    }
    return null;
  }

  async login(
    user: User,
    requestMeta?: { ipAddress?: string; device?: string; client?: string },
  ) {
    if (user.accountStatus === AccountStatusEnum.BLOCKED) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'This account has been blocked. Please contact support.',
      );
    }
    if (user.accountStatus !== AccountStatusEnum.ACTIVE) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'Please verify your account using the OTP sent to your e-mail before signing in.',
      );
    }

    try {
      await this.activityService.createActivity(user.id, 'Signed In', 'signed in successfully.', {
        ipAddress: requestMeta?.ipAddress,
        device: requestMeta?.device,
        client: requestMeta?.client,
      });
    } catch (err) {
      this.logger.error(
        `Failed to log login activity for userId=${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const payload: any = {
      username: user.username,
      sub: user.id,
      role: user.role,
    };
    //console.log('JWT Sign Payload =>', payload);
    const token = this.jwtService.sign(payload);
    const profile = await this.userProfileService.findOneByUserId(user?.id);
    const permissions = await this.userPermissionService.findUserPermissionList(
      user?.id,
    );
    //console.log('User Login user', user);
    const userData = await this.usersService.findByEmail(user?.email);

    // Fetch user job role enrollments
    const enrollments = await this.userJobRoleRepo.find({
      where: { userId: user.id },
      relations: ['jobRole'],
    });

    const userJobRoles = enrollments.map((enrollment) => ({
      userId: enrollment.userId,
      jobRoleId: enrollment.jobRoleId,
      jobRoleTitle: enrollment.jobRole?.title || null,
      createdAt: enrollment.createdAt,
    }));

    // Real, active access — SkillEnrollment is the sole source of truth here, split
    // subject-wise and job-role-wise. Distinct from `userJobRoles` above, which is
    // just career-path targeting (UserJobRole) and carries no access implication.
    const { subjectEnrollments, jobRoleEnrollments } =
      await this.skillEnrollmentService.getMyEnrollmentSummary(user.id);

    const response = new LoginResponseDto({
      id: userData.id,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      username: userData.username,
      role: userData.role,
      city: userData.city,
      country: userData.country,
      mobile: userData.mobile,
      image: userData.image,
      level: userData.level,
      points: userData.points,
      accountStatus: userData.accountStatus,
      token,
      profile,
      permissions,
      userJobRoles,
      subjectEnrollments,
      jobRoleEnrollments,
    });

    return response;
  }

  async autoLogin(user: User) {
    const payload: any = {
      username: user.username,
      sub: user.id,
      role: user.role,
    };
    const token = this.jwtService.sign(payload);
    // UserService.create() always creates the Profile row in the same transaction as the
    // User, before autoLogin() ever runs — so this is a read of data that already exists,
    // not new data collection. Attaching it (same call login() already makes) is what lets
    // the frontend's AuthGuard reliably detect profileCompleted:false right after
    // QuickRegistration and route to onboarding, instead of that happening only as a side
    // effect of `profile` being entirely absent from this response. Deliberately still not
    // attaching permissions/userJobRoles/subjectEnrollments/jobRoleEnrollments here —
    // this stays a minimal response otherwise, on purpose.
    const profile = await this.userProfileService.findOneByUserId(user.id);
    const response = new LoginResponseDto({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      username: user.username,
      role: user.role,
      city: user.city,
      country: user.country,
      mobile: user.mobile,
      image: user.image,
      level: user.level,
      points: user.points,
      accountStatus: user.accountStatus,
      token,
      profile,
    });
    return response;
  }
  async handleGoogleCallback(idToken: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new BadRequestException('Invalid Google token.');
      }

      const { sub, email, given_name, picture } = payload;

      if (!email) {
        throw new BadRequestException(
          'Google account does not contain an email.',
        );
      }

      const [firstName, ...lastNameParts] = (given_name || '')
        .trim()
        .split(' ');
      const lastName = lastNameParts.join(' ');

      const existingUser = await this.usersService.findByEmail(email);

      if (existingUser) {
        await this.userProfileService.updateSocialProfile(existingUser.id, {
          googleId: sub,
          auth_provider: 'Google',
        });

        // Only auto-activate accounts still pending e-mail verification — a BLOCKED
        // account must stay BLOCKED here too, otherwise OAuth login silently
        // overwrites the block and lets login() below wave it through.
        if (existingUser.accountStatus === AccountStatusEnum.PENDING) {
          await this.usersService.updateUser(existingUser.id, {
            accountStatus: AccountStatusEnum.ACTIVE,
          });
        }

        const updatedUser = await this.usersService.findByEmail(email);
        return this.login(updatedUser);
      }

      const user = await this.usersService.create({
        firstName,
        lastName,
        email,
        image: picture || '',
        googleId: sub,
        auth_provider: 'Google',
      });

      return this.login(user);
    } catch (error: any) {
      throw new BadRequestException(
        `Google authentication failed: ${error.message}`,
      );
    }
  }

  async handleLinkedinCallback(code: string) {
    const accessToken = await this.linkedInOAuth.exchangeCodeForToken(code);
    const profile = await this.linkedInOAuth.fetchLinkedInProfile(accessToken);

    const [firstName, ...lastNameParts] = (profile.given_name || '')
      .trim()
      .split(' ');
    const lastName = lastNameParts.join(' ');

    const existingUser = await this.usersService.findByEmail(profile.email);

    if (existingUser) {
      await this.userProfileService.updateSocialProfile(existingUser.id, {
        linkedinId: profile.sub,
        linkedinAccessToken: accessToken,
        linkedinTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        auth_provider: 'LinkedIn',
      });

      // Only auto-activate accounts still pending e-mail verification — a BLOCKED
      // account must stay BLOCKED here too, otherwise OAuth login silently
      // overwrites the block and lets login() below wave it through.
      if (existingUser.accountStatus === AccountStatusEnum.PENDING) {
        await this.usersService.updateUser(existingUser.id, {
          accountStatus: AccountStatusEnum.ACTIVE,
        });
      }

      const updatedUser = await this.usersService.findByEmail(profile.email);
      return this.login(updatedUser);
    }

    const user = await this.usersService.create({
      firstName,
      lastName,
      email: profile.email,
      image: profile.picture || '',
      linkedinId: profile.sub,
      auth_provider: 'LinkedIn',
    });

    await this.userProfileService.updateSocialProfile(user.id, {
      linkedinId: profile.sub,
      linkedinAccessToken: accessToken,
      linkedinTokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      auth_provider: 'LinkedIn',
    });

    return this.login(user);
  }

  /**
   * `callerId` comes from OptionalJwtAuthGuard on the controller — a verified token's own subject,
   * never anything client-supplied in the body — so it can't be spoofed. Only honored for the
   * 'UserRegistration' flow (the admin-panel add-user form); every other caller of this public,
   * unauthenticated endpoint gets createdBy forced to null, same as plain self-signup always has,
   * even if a token happened to be attached.
   */
  async signup(
    createUserDto: CreateUserDto,
    callerId?: number,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const createdBy =
      createUserDto.flow === 'UserRegistration' ? (callerId ?? null) : null;
    return this.usersService.create(createUserDto, createdBy, requestMeta);
  }

  /**
   * Delegates the OTP match + activation/password-change to UserService, then — for a
   * successful ACC_VERIFY — reuses the exact same `login()` used by POST /auth/login (and by
   * the Google/LinkedIn callbacks above) to build the token + profile/permissions/enrollments
   * payload. This lets the frontend apply its normal post-login navigation logic straight off
   * `/auth/verify`'s response, without a second round-trip to `/auth/login`. PWD_RECOVER keeps
   * returning the plain confirmation message — that flow still expects the user to log in
   * afterwards with their new password.
   */
  async accountVerification(accountVerificationDto: AccountVerificationDto) {
    const message = await this.usersService.acoountVerification(
      accountVerificationDto,
    );
    if (accountVerificationDto.tag === UserOtpTagsEnum.ACC_VERIFY) {
      const user = await this.usersService.findByEmail(
        accountVerificationDto.email,
      );
      return this.login(user);
    }
    return message;
  }
}
