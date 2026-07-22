import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { User } from 'src/common/typeorm/entities/user.entity';
import { UserJobRole } from 'src/common/typeorm/entities/user-job-role.entity';
import { JobRole } from 'src/common/typeorm/entities/job-role.entity';
import { AccountStatusEnum } from 'src/core/users/enums/account-status.enum';
import { UserProfileService } from 'src/core/users/providers/user-profile.service';
import { UserService } from 'src/core/users/providers/user.service';
import { AccountVerificationDto } from '../dto/account-verification.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UserPermissionService } from 'src/modules/user-permission/providers/user-permission.service';
import { TopicAnalysisService } from 'src/modules/master/providers/topic-analysis.service';
import { SubjectAnalysisService } from 'src/modules/master/providers/subject-analysis.service';
import { ApiUsageService } from 'src/common/services/api-usage.service';
import { MasterService } from 'src/modules/master/providers/master.service';
import { BadRequestException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import { DataSource } from 'typeorm';
import { UserRoleEnum } from 'src/core/users/enums/user-roles.enum';

interface LinkedInProfile {
  sub: string;
  email: string;
  given_name: string;
  picture: string;
}

@Injectable()
export class AuthService {
  private readonly linkedinClientId = process.env.LINKEDIN_CLIENT_ID;
  private readonly linkedinClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  private readonly linkedinRedirectUri = process.env.LINKEDIN_REDIRECT_URI;

  private readonly googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
  );
  constructor(
    private readonly usersService: UserService,
    private readonly jwtService: JwtService,
    private readonly masterService: MasterService,
    private readonly userProfileService: UserProfileService,
    private readonly userPermissionService: UserPermissionService,
    private readonly subjectAnalyzer: SubjectAnalysisService,
    private readonly topicAnalysisProvider: TopicAnalysisService,
    private readonly apiUsageService: ApiUsageService,

    @InjectRepository(UserJobRole)
    private userJobRoleRepo: Repository<UserJobRole>,
    private readonly dataSource: DataSource,
  ) {}

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

  async login(user: User) {
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
    const courseStats = await this.subjectAnalyzer.getJobSubjectDashboards(
      user?.id,
      false,
    );
    // const topicStats = await this.topicAnalysisProvider.getAllTopicStats(
    //   user?.id,
    //   false,
    // );
    const apiUsage = await this.apiUsageService.findByUserId(user?.id);

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

    const quizStats = await this.masterService.getUserQuizStats(userData.id);

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
      courseStats,
      quizStats,
      apiUsage: {
        count: apiUsage?.count ?? 0,
        lastHitAt: apiUsage?.lastHitAt ?? null,
      },
      //topicStats
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
    //do not attach profile level details
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
      //profile,
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

        if (existingUser.accountStatus !== AccountStatusEnum.ACTIVE) {
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
    const accessToken = await this.exchangeCodeForToken(code);
    const profile = await this.fetchLinkedInProfile(accessToken);

    const [firstName, ...lastNameParts] = (profile.given_name || '')
      .trim()
      .split(' ');
    const lastName = lastNameParts.join(' ');

    const existingUser = await this.usersService.findByEmail(profile.email);

    if (existingUser) {
      await this.userProfileService.updateSocialProfile(existingUser.id, {
        linkedinId: profile.sub,
        auth_provider: 'LinkedIn',
      });

      if (existingUser.accountStatus !== AccountStatusEnum.ACTIVE) {
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

    return this.login(user);
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.linkedinClientId,
      client_secret: this.linkedinClientSecret,
      redirect_uri: this.linkedinRedirectUri,
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data.access_token;
  }

  private async fetchLinkedInProfile(
    accessToken: string,
  ): Promise<LinkedInProfile> {
    const response = await axios.get<LinkedInProfile>(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  /**
   * `callerId` comes from OptionalJwtAuthGuard on the controller — a verified token's own subject,
   * never anything client-supplied in the body — so it can't be spoofed. Only honored for the
   * 'UserRegistration' flow (the admin-panel add-user form); every other caller of this public,
   * unauthenticated endpoint gets createdBy forced to null, same as plain self-signup always has,
   * even if a token happened to be attached.
   */
  async signup(createUserDto: CreateUserDto, callerId?: number) {
    const createdBy = createUserDto.flow === 'UserRegistration' ? (callerId ?? null) : null;
    return this.usersService.create(createUserDto, createdBy);
  }

  async accountVerification(accountVerificationDto: AccountVerificationDto) {
    return this.usersService.acoountVerification(accountVerificationDto);
  }
}
