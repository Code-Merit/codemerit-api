import {
  Logger,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { validate } from 'class-validator';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { UserOtp } from 'src/common/typeorm/entities/user-otp.entity';
import { User } from 'src/common/typeorm/entities/user.entity';
import { generate6DigitNumber } from 'src/common/utils/common-functions';
import {
  generateSlug,
  generateUniqueSlug,
} from 'src/common/utils/slugify.util';
import { AccountVerificationDto } from 'src/core/auth/dto/account-verification.dto';
import { CreateUserDto } from 'src/core/auth/dto/create-user.dto';

import { DataSource, Repository } from 'typeorm';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserProfileResponseDto } from '../dtos/user-profile-response.dto';
import { AccountStatusEnum } from '../enums/account-status.enum';
import { UserOtpTagsEnum } from '../enums/user-otp-Tags.enum';
import { UserOtpService } from './user-otp.service';
import { UserProfileService } from './user-profile.service';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { ApiUsageService } from 'src/common/services/api-usage.service';
import { NotificationService } from 'src/modules/notification/providers/notification.service';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { MailService } from 'src/common/mail/providers/mail.service';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { UserPermissionService } from 'src/modules/user-permission/providers/user-permission.service';
import { UserPermissionEnum } from 'src/common/policies/user-permission.enum';
import { UserRoleEnum } from '../enums/user-roles.enum';

export interface RequestingUser {
  id: number;
  role: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserJobRole)
    private userJobRoleRepo: Repository<UserJobRole>,
    @InjectRepository(JobRole)
    private jobRoleRepo: Repository<JobRole>,
    @InjectRepository(Profile)
    private profileRepo: Repository<Profile>,
    private mailService: MailService,
    private readonly userOtpService: UserOtpService,
    private readonly userProfileService: UserProfileService,
    private readonly apiUsageService: ApiUsageService,
    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
    private readonly activityService: ActivityService,
    private readonly userPermissionService: UserPermissionService,
  ) {}

  /**
   * `createdBy` is a separate, explicit parameter — never read off the client-supplied `data` —
   * so it can only ever be set by a trusted server-side caller (createUserByPrivilegedCaller
   * below), not smuggled in through a public, unauthenticated request body. Self-service signup
   * (native + Google/LinkedIn) always leaves it null: nobody "added" a user who signed up
   * themselves.
   */
  async create(
    data: Partial<CreateUserDto>,
    createdBy: number | null = null,
    requestMeta?: { ipAddress?: string; userAgent?: string },
  ): Promise<User> {
    const existingEmail = await this.findByEmail(data.email);
    console.log('existingEmail', existingEmail);

    if (existingEmail) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        `E-mail already exists.`,
      );
    }

    if (data.mobile) {
      const existingMobile = await this.findByMobile(data.mobile);
      if (existingMobile) {
        throw new AppCustomException(
          HttpStatus.BAD_REQUEST,
          `Mobile number already exists.`,
        );
      }
    }

    //Start Query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = this.userRepo.create(data as Partial<User>);
      user.createdBy = createdBy;
      if (data.image) {
        user.image = data.image;
      }
      if (requestMeta?.ipAddress) {
        user.ipAddress = requestMeta.ipAddress;
      }
      if (requestMeta?.userAgent) {
        user.userAgent = requestMeta.userAgent;
      }

      const isSocialLogin =
        data.auth_provider === 'Google' || data.auth_provider === 'LinkedIn';

      user.accountStatus = isSocialLogin
        ? AccountStatusEnum.ACTIVE
        : AccountStatusEnum.PENDING;

      if (data.dreamRole) {
        user.designation = data.dreamRole;
      }
      const pass = isSocialLogin
        ? crypto.randomBytes(32).toString('hex')
        : generate6DigitNumber();

      user.password = await bcrypt.hash(pass, 10);
      const fullname = user.firstName + ' ' + user.lastName;
      let username = generateSlug(fullname);
      const existing = await this.userRepo.findOne({ where: { username } });
      if (existing) {
        username = generateUniqueSlug(fullname);
      }
      user.username = username;
      const errors = await validate(user);
      if (errors.length) {
        throw new AppCustomException(
          HttpStatus.BAD_REQUEST,
          `User validation failed`,
        );
      }
      const savedUser = await queryRunner.manager.save(user);
      //Send e-mail
      try {
        if (savedUser.accountStatus === AccountStatusEnum.ACTIVE) {
          await this.mailService.sendAccountVerifiedEmail(
            savedUser.email,
            savedUser.firstName,
          );
        } else {
          await this.mailService.sendRegistrationWelcomeEmail(
            savedUser.email,
            savedUser.firstName,
            pass,
          );
        }
      } catch (error) {
        console.log('CMRegistration Error sending e-mail => ', error);
      }
      const profile = new Profile();
      profile.userId = savedUser.id;
      //validate on client
      if (data.about) {
        profile.about = data.about;
      }
      if (data.yearsExperience !== undefined && data.yearsExperience !== null) {
        profile.experience = Number(data.yearsExperience);
      }
      if (data.linkedinUrl) {
        profile.linkedinUrl = data.linkedinUrl;
      }
      if (data.googleId) {
        profile.googleId = data.googleId;
      }
      if (data.linkedinId) {
        profile.linkedinId = data.linkedinId;
      }

      profile.auth_provider = data.auth_provider || 'Native';
      await queryRunner.manager.save(profile);

      const jobRoleId = Number(data.techRoleId || data.jobRoleId);
      if (jobRoleId) {
        const jobRole = await queryRunner.manager.findOne(JobRole, {
          where: { id: jobRoleId },
        });

        if (!jobRole) {
          throw new AppCustomException(
            HttpStatus.NOT_FOUND,
            'Job role not found.',
          );
        }

        const userJobRole = queryRunner.manager.create(UserJobRole, {
          userId: savedUser.id,
          jobRoleId,
          createdBy: savedUser.id,
        });
        await queryRunner.manager.save(UserJobRole, userJobRole);
      }

      await queryRunner.commitTransaction();
      // Send OTP only for Native registration
      if (!isSocialLogin) {
        try {
          const otp = await this.sendOtp(
            savedUser?.email,
            pass,
            UserOtpTagsEnum.ACC_VERIFY,
            true,
          );
          console.log('CMRegistration Send otp => ', otp);
        } catch (error) {
          console.log('CMRegistration Send otp exception => ', error);
        }
      }

      const userResponse = this.findOne(savedUser?.id);
      return userResponse;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findByEmail(email: string): Promise<User | undefined> {
    //Gives all fields
    const user = await this.userRepo.findOne({
      where: { email },
    });

    return user;
  }

  async findByEmailForLogin(email: string): Promise<User | undefined> {
    return this.userRepo.findOne({
      where: { email },
      select: [
        'id',
        'firstName',
        'lastName',
        'username',
        'role',
        'email',
        'mobile',
        'password',
        'accountStatus',
      ],
    });
  }

  async findByMobile(mobile: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { mobile } });
  }

  async findByUsername(
    username: string,
  ): Promise<UserProfileResponseDto | undefined> {
    const user = await this.userRepo.findOne({ where: { username } });

    if (!user) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'User not Found.');
    }
    const profile = await this.userProfileService.findOneByUserId(user?.id);
    const userProfileResponse: UserProfileResponseDto = {
      ...user,
      profile,
    };

    return userProfileResponse;
  }

  async findOne(id: number): Promise<User | undefined> {
    return this.userRepo.findOne({ where: { id } });
  }

  async getOwnUserInfo(
    id: number,
  ): Promise<UserProfileResponseDto | undefined> {
    const user = await this.userRepo.findOne({
      where: { id },
    });
    if (!user) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'User not Found.');
    }
    const [profile, permissions] = await Promise.all([
      this.userProfileService.findOneByUserId(user?.id),
      this.userPermissionService.getPermissionsForProfile(user.id),
    ]);
    const userProfileResponse: UserProfileResponseDto = {
      ...user,
      profile,
      permissions,
    };

    return userProfileResponse;
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  /** Talent Partners get the same broad, unscoped "can manage users" grant Admins have — the
   * "Role:" prefix on TalentPartner (see UserPermissionEnum) marks it as a capability grant, not
   * something scoped to one subject/topic, so a plain existence check is the right one here. */
  private async isTalentPartner(userId: number): Promise<boolean> {
    return this.userPermissionService.hasPermission(userId, UserPermissionEnum.TalentPartner);
  }

  /** Throws if caller is neither Admin nor a Talent-Partner-permission holder — the shared gate
   * for every "Manage Users" capability (list/create/edit), now that this is reachable by more
   * than just Admins. Returns isAdmin so callers can further branch (e.g. which fields/rows a
   * Talent Partner may see or touch vs. an Admin's unrestricted access). */
  private async ensureCanManageUsers(caller: RequestingUser): Promise<{ isAdmin: boolean }> {
    const isAdmin = caller.role === UserRoleEnum.ADMIN;
    if (!isAdmin && !(await this.isTalentPartner(caller.id))) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'You do not have permission to manage users.',
      );
    }
    return { isAdmin };
  }

  /** The Admin/Talent-Partner-facing counterpart to public self-signup (`AuthService.signup`) —
   * same underlying `create()`, but `createdBy` is stamped from the verified caller, not the
   * request body, so "users I added" (findUserList's Talent-Partner filter, updateUser's
   * ownership check) rests on a trustworthy value instead of client-supplied data. */
  async createUserByPrivilegedCaller(
    caller: RequestingUser,
    dto: CreateUserDto,
  ): Promise<User> {
    await this.ensureCanManageUsers(caller);
    return this.create(dto, caller.id);
  }

  /** Counts rows of `tableName` grouped by its `userId` column, for the given user ids — used to
   * add lightweight aggregate fields (numJobRoles/numQuizTaken/numAssessments) to the user list
   * without join-fanout: each is one small grouped query, same batching shape as
   * apiUsageService.findMapByUserIds, rather than multiplying findUserList's own join further. */
  private async countMapByUserIds(tableName: string, userIds: number[]): Promise<Map<number, number>> {
    if (!userIds.length) return new Map();
    const rows = await this.dataSource
      .createQueryBuilder()
      .select('t.userId', 'userId')
      .addSelect('COUNT(*)', 'cnt')
      .from(tableName, 't')
      .where('t.userId IN (:...userIds)', { userIds })
      .groupBy('t.userId')
      .getRawMany();
    return new Map(rows.map((r) => [Number(r.userId), Number(r.cnt)]));
  }

  async findUserList(caller: RequestingUser): Promise<any[]> {
    const { isAdmin } = await this.ensureCanManageUsers(caller);
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoin('user_job_role', 'userJobRole', 'userJobRole.userId = user.id')
      .leftJoin('job_role', 'jobRole', 'jobRole.id = userJobRole.jobRoleId')
      .select([
        'user.id AS id',
        'user.firstName AS firstName',
        'user.lastName AS lastName',
        'user.username AS username',
        'user.role AS role',
        'user.designation AS designation',
        'user.city AS city',
        'user.country AS country',
        'user.email AS email',
        'user.mobile AS mobile',
        'user.level AS level',
        'user.points AS points',
        'user.accountStatus AS accountStatus',
        'user.createdAt AS createdAt',
        'jobRole.title AS jobRoleTitle',
      ]);

    // Talent Partners only manage the accounts they personally added — Admins still see everyone.
    if (!isAdmin) {
      qb.andWhere('user.createdBy = :callerId', { callerId: caller.id });
    }

    const rows = await qb.getRawMany();

    const userIds = [...new Set(rows.map((row) => Number(row.id)))];
    const [usageMap, jobRoleCountMap, quizCountMap, assessmentCountMap] = await Promise.all([
      this.apiUsageService.findMapByUserIds(userIds),
      this.countMapByUserIds('user_job_role', userIds),
      this.countMapByUserIds('quiz_result', userIds),
      this.countMapByUserIds('assessment_session', userIds),
    ]);

    const userMap = new Map<number, any>();

    for (const row of rows) {
      const userId = Number(row.id);
      const apiUsage = usageMap.get(userId);

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: userId,
          firstName: row.firstName,
          lastName: row.lastName,
          username: row.username,
          role: row.role,
          designation: row.designation,
          city: row.city,
          country: row.country,
          email: row.email,
          mobile: row.mobile,
          level: row.level,
          points: row.points,
          numJobRoles: jobRoleCountMap.get(userId) ?? 0,
          numQuizTaken: quizCountMap.get(userId) ?? 0,
          numAssessments: assessmentCountMap.get(userId) ?? 0,
          // Visible to everyone who can call this list (Admin + Talent Partner) — read-only here.
          // The actual restriction is edit access: updateUser() still rejects a Talent Partner
          // trying to *change* accountStatus, regardless of whether they can see it in the list.
          accountStatus: row.accountStatus,
          createdAt: row.createdAt,
          jobRoleTitles: [] as string[],
          apiUsage: {
            count: apiUsage?.count ?? 0,
            lastHitAt: apiUsage?.lastHitAt ?? null,
          },
        });
      }

      if (row.jobRoleTitle) {
        const user = userMap.get(userId);
        if (!user.jobRoleTitles.includes(row.jobRoleTitle)) {
          user.jobRoleTitles.push(row.jobRoleTitle);
        }
      }
    }

    return Array.from(userMap.values());
  }

  async updateUserAccountStatus(
    id: number,
    accountStatusEnum: AccountStatusEnum,
  ): Promise<boolean> {
    const result = await this.userRepo.update(
      { id: id },
      { accountStatus: accountStatusEnum },
    );
    if (result.affected && result.affected > 0) {
      return true;
    } else {
      return false;
    }
  }

  async updateUserPassword(id: number, password: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await this.userRepo.update(
      { id: id },
      { password: hashedPassword },
    );
    if (result.affected && result.affected > 0) {
      return true;
    } else {
      return false;
    }
  }

  async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    if (currentPassword === newPassword) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'New password must be different from current password.',
      );
    }

    const user = await this.userRepo.findOne({
      where: { id },
      select: ['id', 'email', 'firstName', 'password'],
    });

    if (!user) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'User not found.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Incorrect current password.',
      );
    }

    const isSameAsStoredPassword = await bcrypt.compare(
      newPassword,
      user.password,
    );

    if (isSameAsStoredPassword) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'New password must be different from current password.',
      );
    }

    const result = await this.updateUserPassword(id, newPassword);

    if (result) {
      try {
        await this.mailService.sendPasswordChangedEmail(
          user.email,
          user.firstName,
        );
      } catch (err) {
        this.logger.error(
          `Failed to send password-changed e-mail: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      try {
        await this.activityService.createActivity(
          user.id,
          'Password Changed',
          'Your account password was updated successfully.',
          String(user.id),
          'USER',
        );
      } catch (err) {
        if (err instanceof Error) {
          this.logger.error(
            `Failed to log password change activity: ${err.message}`,
            err.stack,
          );
        } else {
          this.logger.error(
            `Failed to log password change activity: ${String(err)}`,
          );
        }
      }
    }

    return result;
  }

  async sendOtp(
    email: string,
    pass: string,
    tag: UserOtpTagsEnum,
    isNewRegistration = false,
  ): Promise<string | null> {
    const user: User = await this.findByEmail(email);
    if (!user) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Invalid e-mail address.',
      );
    } else if (
      user.accountStatus == AccountStatusEnum.ACTIVE &&
      tag == UserOtpTagsEnum.ACC_VERIFY
    ) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'User is already verified.',
      );
    }
    let userOtp: UserOtp = new UserOtp();
    userOtp.otp = pass ? pass : generate6DigitNumber();
    userOtp.userId = user?.id;
    userOtp.tag = tag;
    const result = await this.userOtpService.create(userOtp);
    //check if limit not exceeded for sending OTP. If exceeded, do not send e-mail and return error message
    try {
      if (isNewRegistration) {
        await this.mailService.sendRegistrationWelcomeEmail(
          email,
          user.firstName,
          userOtp.otp,
        );
      } else {
        await this.mailService.sendOtpEmail(
          email,
          user.firstName,
          userOtp.otp,
          tag,
        );
      }
    } catch (error) {
      console.log('CMRegistration Error sending e-mail => ', error);
    }

    if (result) {
      return 'OTP sent Successfully.';
    }
    return null;
  }

  async acoountVerification(
    accountVerificationDto: AccountVerificationDto,
  ): Promise<string | null> {
    const user: User = await this.findByEmail(accountVerificationDto?.email);

    if (!user) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Invalid e-mail address.',
      );
    }
    const userOtpList: UserOtp[] = await this.userOtpService.findByUserIdTags(
      user.id,
      accountVerificationDto.tag,
    );
    if (
      userOtpList &&
      userOtpList?.length > 0 &&
      accountVerificationDto.otp === userOtpList[0].otp
    ) {
      let userOtp: UserOtp = userOtpList[0];
      userOtp.isUsed = true;
      const result = await this.userOtpService.updateIsUsed(userOtp?.id);
      let userRs: boolean = false;
      let msg: string = '';
      let isPasswordChange = false;
      let isAccountVerify = false;

      if (accountVerificationDto.tag == UserOtpTagsEnum.ACC_VERIFY) {
        userRs = await this.updateUserAccountStatus(
          user?.id,
          AccountStatusEnum.ACTIVE,
        );
        msg = 'Your account is now verified.';
        if (userRs) {
          isAccountVerify = true;
          await this.notificationService.notifyAccountVerified(
            user.id,
            user.firstName,
          );
          try {
            await this.mailService.sendAccountVerifiedEmail(
              user.email,
              user.firstName,
            );
          } catch (err) {
            this.logger.error(
              `Failed to send account-verified e-mail: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }
      if (accountVerificationDto.tag == UserOtpTagsEnum.PWD_RECOVER) {
        userRs = await this.updateUserPassword(
          user?.id,
          accountVerificationDto?.password,
        );
        msg = 'Successfully change your password.';
        if (userRs) {
          isPasswordChange = true;
          try {
            await this.mailService.sendPasswordChangedEmail(
              user.email,
              user.firstName,
            );
          } catch (err) {
            this.logger.error(
              `Failed to send password-changed e-mail: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      if (result && userRs) {
        // Safe Background Activity Logging Hooks
        if (isAccountVerify) {
          try {
            await this.activityService.createActivity(
              user.id,
              'User Registration',
              'Your account has been verified and created successfully.',
              String(user.id),
              'USER',
            );
          } catch (err) {
            if (err instanceof Error) {
              this.logger.error(
                `Failed to log registration activity: ${err.message}`,
                err.stack,
              );
            } else {
              this.logger.error(
                `Failed to log registration activity: ${String(err)}`,
              );
            }
          }
        }

        if (isPasswordChange) {
          try {
            await this.activityService.createActivity(
              user.id,
              'Password Changed',
              'Your account password was updated successfully.',
              String(user.id),
              'USER',
            );
          } catch (err) {
            if (err instanceof Error) {
              this.logger.error(
                `Failed to log password change activity: ${err.message}`,
                err.stack,
              );
            } else {
              this.logger.error(
                `Failed to log password change activity: ${String(err)}`,
              );
            }
          }
        }

        return msg;
      } else {
        throw new AppCustomException(
          HttpStatus.BAD_REQUEST,
          'Account not verified. Please try again.',
        );
      }
    } else {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'OTP mismatch. Please try again.',
      );
    }
  }

  /**
   * `caller` is omitted for trusted, system-initiated calls (e.g. auth.service.ts auto-activating
   * a user's own account right after a Google/LinkedIn callback) — those aren't a "manage someone
   * else's account" action at all, so they skip the gate below entirely. A caller editing their
   * own account (e.g. the onboarding page setting `designation`) similarly isn't "managing users"
   * and skips the Talent-Partner/Admin gate — it just can't touch its own role/accountStatus.
   * Editing anyone else always goes through the Talent-Partner restrictions (can't touch an
   * already-Active user, can't change role/accountStatus, must be a user they added).
   */
  async updateUser(
    userId: number,
    updateUserDto: UpdateUserDto,
    caller?: RequestingUser,
  ): Promise<User> {
    // createdBy has `select: false` on the entity, so a plain findOne() never loads it — needed
    // explicitly here (and only here) for the ownership check below; addSelect is the standard
    // way to pull one hidden column back in without changing every other findOne() caller's shape.
    const user = caller
      ? await this.userRepo
          .createQueryBuilder('user')
          .addSelect('user.createdBy')
          .where('user.id = :userId', { userId })
          .getOne()
      : await this.findOne(userId);
    if (!user) {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'User not found');
    }

    if (caller && caller.id === userId) {
      if (updateUserDto.role !== undefined) {
        throw new AppCustomException(
          HttpStatus.FORBIDDEN,
          'You cannot change your own role.',
        );
      }
      if (updateUserDto.accountStatus !== undefined) {
        throw new AppCustomException(
          HttpStatus.FORBIDDEN,
          'You cannot change your own account status.',
        );
      }
    } else if (caller) {
      const { isAdmin } = await this.ensureCanManageUsers(caller);
      if (!isAdmin) {
        if (user.createdBy !== caller.id) {
          throw new AppCustomException(
            HttpStatus.FORBIDDEN,
            'Talent Partners can only edit users they added.',
          );
        }
        if (user.accountStatus === AccountStatusEnum.ACTIVE) {
          throw new AppCustomException(
            HttpStatus.FORBIDDEN,
            'Talent Partners cannot edit an active user.',
          );
        }
        if (updateUserDto.accountStatus !== undefined) {
          throw new AppCustomException(
            HttpStatus.FORBIDDEN,
            'Talent Partners cannot change a user\'s account status.',
          );
        }
        if (updateUserDto.role !== undefined) {
          throw new AppCustomException(
            HttpStatus.FORBIDDEN,
            'Talent Partners cannot change a user\'s role.',
          );
        }
      }
    }

    const { linkedinUrl, ...userFields } = updateUserDto as UpdateUserDto & {
      linkedinUrl?: string;
    };

    this.userRepo.merge(user, userFields);
    const savedUser = await this.userRepo.save(user);

    if (linkedinUrl !== undefined) {
      let profile = await this.profileRepo.findOne({ where: { userId } });

      if (!profile) {
        profile = this.profileRepo.create({
          userId,
          auth_provider: 'Native',
        });
      }

      profile.linkedinUrl = linkedinUrl;
      await this.profileRepo.save(profile);
    }

    return savedUser;
  }

  async remove(id: number, caller: RequestingUser): Promise<void> {
    if (caller.role !== UserRoleEnum.ADMIN) {
      throw new AppCustomException(
        HttpStatus.FORBIDDEN,
        'Only Admins can delete users.',
      );
    }
    const user = await this.findOne(id);
    if (user) {
      await this.userRepo.update(id, {
        accountStatus: AccountStatusEnum.BLOCKED,
      });
      await this.userProfileService.removeByUserId(id);
      await this.userRepo.softDelete({ id: id });
    } else {
      throw new AppCustomException(HttpStatus.BAD_REQUEST, 'User not found');
    }
  }

  async enrollJobRole(userId: number, jobRoleId: number): Promise<UserJobRole> {
    const user = await this.findOne(userId);
    if (!user) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'User not found.');
    }

    const jobRole = await this.jobRoleRepo.findOne({
      where: { id: jobRoleId },
    });
    if (!jobRole) {
      throw new AppCustomException(HttpStatus.NOT_FOUND, 'Job role not found.');
    }

    const existing = await this.userJobRoleRepo.findOne({
      where: { userId, jobRoleId },
    });

    if (existing) {
      throw new AppCustomException(
        HttpStatus.CONFLICT,
        `User is already enrolled in this job role.`,
      );
    }

    const enrollment = this.userJobRoleRepo.create({
      userId,
      jobRoleId,
      createdBy: userId,
    });

    const saved = await this.userJobRoleRepo.save(enrollment);

    await this.notificationService.notifyRoleEnrolled(
      userId,
      user.firstName,
      jobRole.title,
      jobRole.id,
    );

    return saved;
  }

  /** The job role a user enrolled in first (i.e. the one set at registration, if
   * any) — used to scope the one-time initial assessment quiz. */
  async getEarliestJobRoleId(userId: number): Promise<number | null> {
    const enrollment = await this.userJobRoleRepo.findOne({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return enrollment?.jobRoleId ?? null;
  }
}
