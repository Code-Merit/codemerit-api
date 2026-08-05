import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsEnum,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { WorkStatusEnum } from '../enums/work-status.enum';
import { IntentEnum } from '../enums/intent.enum';
import { TimelineEnum } from '../enums/timeline.enum';
import { ReferralSourceEnum } from '../enums/referral-source.enum';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    example: 'https://linkedin.com/in/username',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: 'A brief about the user', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  about?: string;

  @ApiPropertyOptional({ example: '1234567890abcdef', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  googleId?: string;

  @ApiPropertyOptional({ example: 'linkedin-unique-id', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  linkedinId?: string;

  @ApiPropertyOptional({ example: 'google', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  auth_provider?: string;

  @ApiPropertyOptional({ enum: WorkStatusEnum, example: WorkStatusEnum.FRESHER })
  @IsOptional()
  @IsEnum(WorkStatusEnum)
  workStatus?: WorkStatusEnum;

  // Pursuing / Fresher branch — required together whenever `workStatus` is set to
  // PURSUING or FRESHER in this same request (this endpoint is a partial patch,
  // so these are only enforced when the caller is actively setting that workStatus).
  @ApiPropertyOptional({ example: 'ABC Institute of Technology' })
  @ValidateIf(
    (o) =>
      o.workStatus === WorkStatusEnum.PURSUING ||
      o.workStatus === WorkStatusEnum.FRESHER,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  collegeName?: string;

  @ApiPropertyOptional({ example: 'Computer Science' })
  @ValidateIf(
    (o) =>
      o.workStatus === WorkStatusEnum.PURSUING ||
      o.workStatus === WorkStatusEnum.FRESHER,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  stream?: string;

  @ApiPropertyOptional({ example: '2025' })
  @ValidateIf(
    (o) =>
      o.workStatus === WorkStatusEnum.PURSUING ||
      o.workStatus === WorkStatusEnum.FRESHER,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  passingYear?: string;

  @ApiPropertyOptional({ example: true })
  @ValidateIf(
    (o) =>
      o.workStatus === WorkStatusEnum.PURSUING ||
      o.workStatus === WorkStatusEnum.FRESHER,
  )
  @IsNotEmpty()
  @IsBoolean()
  hasCompletedInternship?: boolean;

  @ApiPropertyOptional({
    example: 6,
    description: 'Internship duration in months. Required when hasCompletedInternship is true.',
  })
  @ValidateIf((o) => o.hasCompletedInternship === true)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  internshipDuration?: number;

  // Experienced branch — required together whenever `workStatus` is set to
  // EXPERIENCED in this same request.
  @ApiPropertyOptional({ example: 3, description: 'Years of experience.' })
  @ValidateIf((o) => o.workStatus === WorkStatusEnum.EXPERIENCED)
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional({ example: true })
  @ValidateIf((o) => o.workStatus === WorkStatusEnum.EXPERIENCED)
  @IsNotEmpty()
  @IsBoolean()
  isCurrentlyEmployed?: boolean;

  @ApiPropertyOptional({
    example: 'Acme Corp',
    description: 'Current or previous employer, depending on isCurrentlyEmployed.',
  })
  @ValidateIf((o) => o.workStatus === WorkStatusEnum.EXPERIENCED)
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  companyName?: string;

  @ApiPropertyOptional({ example: 12, description: 'Certification track id.' })
  @IsOptional()
  @IsInt()
  subjectTrackId?: number;

  @ApiPropertyOptional({ example: 50, description: 'Self-reported mastery level, 0-100.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  masteryLevel?: number;

  // Onboarding "Goals" step — optional/skippable, no @ValidateIf branch gating.
  @ApiPropertyOptional({ enum: IntentEnum, example: IntentEnum.GET_FIRST_JOB })
  @IsOptional()
  @IsEnum(IntentEnum)
  intent?: IntentEnum;

  @ApiPropertyOptional({ enum: TimelineEnum, example: TimelineEnum.ONE_TO_THREE_MONTHS })
  @IsOptional()
  @IsEnum(TimelineEnum)
  timeline?: TimelineEnum;

  @ApiPropertyOptional({ enum: ReferralSourceEnum, example: ReferralSourceEnum.SOCIAL })
  @IsOptional()
  @IsEnum(ReferralSourceEnum)
  referralSource?: ReferralSourceEnum;
}
