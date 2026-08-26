import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Profile } from 'src/common/typeorm/entities/profile.entity';
import { QuizResult } from 'src/common/typeorm/entities/quiz-result.entity';
import { AppCustomException } from 'src/common/exceptions/app-custom-exception.filter';
import { ActivityService } from 'src/modules/activity/providers/activity/activity.service';
import { WorkStatusEnum } from '../enums/work-status.enum';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(QuizResult)
    private quizResultRepository: Repository<QuizResult>,
    private readonly activityService: ActivityService,
  ) {}

  async createEmpty(manager: EntityManager): Promise<Profile> {
    const profile = manager.create(Profile);
    const savedProfile = await manager.save(profile);
    return savedProfile;
  }

  async create(profile: Profile): Promise<Profile> {
    const savedProfile = await this.profileRepository.save(profile);
    return savedProfile;
  }

  async findOne(id: number): Promise<Profile | undefined> {
    return this.profileRepository.findOne({ where: { id } });
  }

  async findOneByUserId(
    id: number,
  ): Promise<(Profile & { playedQuiz: boolean }) | undefined> {
    const profile = await this.profileRepository.findOne({
      where: { userId: id },
      select: [
        'id',
        'linkedinUrl',
        'about',
        'googleId',
        'linkedinId',
        'auth_provider',
        'experience',
        'workStatus',
        'collegeName',
        'stream',
        'passingYear',
        'hasCompletedInternship',
        'internshipDuration',
        'isCurrentlyEmployed',
        'companyName',
        'subjectTrackId',
        'masteryLevel',
        'profileCompleted',
        'linkedinAccessToken',
        'linkedinTokenExpiresAt',
      ],
    });
    if (!profile) return undefined;

    // playedQuiz is derived live from QuizResult rather than stored — a stored
    // flag would either need updating on every quiz submission everywhere (not
    // just the initial assessment) or drift out of sync with the actual truth,
    // which QuizResult already holds authoritatively.
    const playedQuiz =
      (await this.quizResultRepository.count({ where: { userId: id } })) > 0;

    return { ...profile, playedQuiz };
  }

  async findAll(): Promise<Profile[]> {
    return this.profileRepository.find();
  }

  async updateProfile(userId: number, dto: Partial<Profile>): Promise<Profile> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Profile not found.',
      );
    }
    this.assertWorkStatusConsistency(dto);

    // profileCompleted is server-managed, never client-writable — strip it even though
    // UpdateUserProfileDto doesn't declare it (the global ValidationPipe isn't whitelisted, so
    // an unknown body property would otherwise pass straight through to Object.assign below).
    const safeDto: Partial<Profile> = { ...dto };
    delete safeDto.profileCompleted;
    Object.assign(profile, safeDto);

    // A workStatus branch only ever reaches here fully populated — assertWorkStatusConsistency
    // plus UpdateUserProfileDto's @ValidateIf rules already guarantee that. So submitting
    // workStatus at all is exactly the "user has gone through the post-registration profile
    // form" signal the frontend needs; once true, later unrelated edits (e.g. `about`) never
    // flip it back.
    if (dto.workStatus) {
      profile.profileCompleted = true;
    }

    const savedProfile = await this.profileRepository.save(profile);

    // Only `about` reads as a visible "profile update" in the social-feed sense — everything
    // else here is onboarding-form data (education/experience/workStatus), not worth an activity.
    if (dto.about !== undefined) {
      try {
        await this.activityService.createActivity(
          userId,
          'Profile Updated',
          'updated profile details.',
          { dataId: String(userId), dataType: 'USER' },
        );
      } catch (err) {
        this.logger.error(
          `Failed to log profile-update activity for userId=${userId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return savedProfile;
  }

  // DTO-level @ValidateIf only enforces "required when workStatus is X" — it can't
  // express "forbidden when workStatus is not X", so combos like sending
  // education fields alongside EXPERIENCED, or internshipDuration alongside
  // hasCompletedInternship === false, would otherwise pass request validation.
  private assertWorkStatusConsistency(dto: Partial<Profile>): void {
    if (dto.workStatus === WorkStatusEnum.EXPERIENCED) {
      if (
        dto.collegeName !== undefined ||
        dto.stream !== undefined ||
        dto.passingYear !== undefined ||
        dto.hasCompletedInternship !== undefined ||
        dto.internshipDuration !== undefined
      ) {
        throw new AppCustomException(
          HttpStatus.BAD_REQUEST,
          'Education/internship fields cannot be set when workStatus is Experienced.',
        );
      }
    }

    if (
      dto.workStatus === WorkStatusEnum.PURSUING ||
      dto.workStatus === WorkStatusEnum.FRESHER
    ) {
      if (
        dto.experience !== undefined ||
        dto.isCurrentlyEmployed !== undefined ||
        dto.companyName !== undefined
      ) {
        throw new AppCustomException(
          HttpStatus.BAD_REQUEST,
          'Experience/employment fields cannot be set when workStatus is Pursuing or Fresher.',
        );
      }
    }

    if (
      dto.hasCompletedInternship === false &&
      dto.internshipDuration !== undefined
    ) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'internshipDuration cannot be set when hasCompletedInternship is false.',
      );
    }
  }

  async updateSocialProfile(
    userId: number,
    data: {
      googleId?: string;
      linkedinId?: string;
      linkedinAccessToken?: string;
      linkedinTokenExpiresAt?: Date;
      // Optional — omitted by the "connect LinkedIn for sharing while already signed in" flow
      // (LinkedinShareService.connectAccount), which must never overwrite how an existing
      // email/password (or Google-signed-in) account thinks it signs in just because the owner
      // also linked LinkedIn for posting.
      auth_provider?: string;
    },
  ): Promise<Profile> {
    const profile = await this.profileRepository.findOne({
      where: { userId },
    });

    if (!profile) {
      throw new AppCustomException(
        HttpStatus.BAD_REQUEST,
        'Profile not found.',
      );
    }

    if (data.googleId) {
      profile.googleId = data.googleId;
    }

    if (data.linkedinId) {
      profile.linkedinId = data.linkedinId;
    }

    if (data.linkedinAccessToken) {
      profile.linkedinAccessToken = data.linkedinAccessToken;
    }

    if (data.linkedinTokenExpiresAt) {
      profile.linkedinTokenExpiresAt = data.linkedinTokenExpiresAt;
    }

    if (data.auth_provider) {
      profile.auth_provider = data.auth_provider;
    }

    return this.profileRepository.save(profile);
  }

  async remove(id: number): Promise<void> {
    await this.profileRepository.delete(id);
  }

  async removeByUserId(userId: number): Promise<void> {
    await this.profileRepository.delete({ userId });
  }
}
