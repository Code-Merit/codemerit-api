import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DefaultLandingPageEnum } from 'src/common/enum/default-landing-page.enum';

// Partial patch (PUT /apis/preferences/me) — omitted fields are left untouched.
export class UpdateUserPreferenceDto {
  @ApiPropertyOptional({ example: true, description: 'Badge/level-up/streak/certificate emails.' })
  @IsOptional()
  @IsBoolean()
  emailAchievements?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Job-role/subject enrollment confirmation emails.' })
  @IsOptional()
  @IsBoolean()
  emailEnrollmentConfirmations?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Product news and announcement emails.' })
  @IsOptional()
  @IsBoolean()
  emailProductUpdates?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Nudges to finish in-progress quizzes / keep a streak going.' })
  @IsOptional()
  @IsBoolean()
  emailQuizReminders?: boolean;

  @ApiPropertyOptional({ example: false, description: 'A periodic summary email of activity/progress.' })
  @IsOptional()
  @IsBoolean()
  emailWeeklyDigest?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Whether GET /apis/users/public-profile/:username exposes this user at all.' })
  @IsOptional()
  @IsBoolean()
  isProfilePublic?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Whether this user can appear in any public leaderboard/merit list.' })
  @IsOptional()
  @IsBoolean()
  showOnLeaderboard?: boolean;

  @ApiPropertyOptional({ enum: DefaultLandingPageEnum, example: DefaultLandingPageEnum.AUTO })
  @IsOptional()
  @IsEnum(DefaultLandingPageEnum)
  defaultLandingPage?: DefaultLandingPageEnum;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', description: 'IANA timezone name.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
