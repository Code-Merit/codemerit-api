import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssessmentSessionStatusEnum } from 'src/common/enum/assessment-session-status.enum';
import { SkillTypeEnum } from 'src/common/enum/skill-type.enum';

export class SkillRatingDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  skillId: number;

  @ApiProperty({
    enum: SkillTypeEnum,
    example: SkillTypeEnum.SUBJECT,
  })
  @IsEnum(SkillTypeEnum)
  skillType: SkillTypeEnum;

  @ApiProperty({ example: 4 })
  @IsInt()
  rating: number;
}

export class SubmitInterviewDto {
  @ApiProperty({
    enum: AssessmentSessionStatusEnum,
    example: AssessmentSessionStatusEnum.COMPLETED,
    description:
      'Must be COMPLETED or DECLINED. DECLINED is reserved for integrity issues found while ' +
      'actually conducting the round (cheating, unauthorized assistance, other misconduct) — it is ' +
      'not a way to opt out of an unstarted round. A round can only be declined after it has been ' +
      'started (see startInterview); an SME who never starts a round cannot decline it — a manager ' +
      'cancels it instead (PUT /:id/rounds/:sessionId/cancel).',
  })
  @IsEnum(AssessmentSessionStatusEnum)
  status: AssessmentSessionStatusEnum;

  @ApiPropertyOptional({
    example: 'Strong backend fundamentals and good communication.',
  })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({
    example: 'Candidate was found using unauthorized assistance (a second screen with visible answers) during the session.',
    description: 'Required when status is DECLINED — the specific integrity/misconduct issue observed.',
  })
  @IsOptional()
  @IsString()
  declineReason?: string;

  @ApiProperty({
    type: [SkillRatingDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillRatingDto)
  skillRatings: SkillRatingDto[];
}
