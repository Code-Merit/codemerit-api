import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class SelfSkillRatingEntryDto {
  @ApiProperty({ example: 3, description: 'SkillMetric id (see GET /apis/skill-ratings/skill-metrics)' })
  @IsInt()
  skillId: number;

  @ApiProperty({ example: 4, minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  rating: number;
}

// Backs POST apis/skill-ratings/self — userId and ratingType are forced server-side (SELF only),
// so a caller can only ever rate themselves, against the SkillMetric catalog.
export class CreateSelfAssessmentDto {
  @ApiPropertyOptional({ example: 'Self Assessment' })
  @IsOptional()
  @IsString()
  assessmentTitle?: string;

  @ApiProperty({ type: [SelfSkillRatingEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelfSkillRatingEntryDto)
  skillRatings: SelfSkillRatingEntryDto[];
}
